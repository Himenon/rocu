import * as fs from "fs";
import * as http from "http";
import * as path from "path";
import * as url from "url";

import * as chokidar from "chokidar";
import * as portfinder from "portfinder";
import * as WebSocket from "ws";

import { DevelopOption } from "@custom-site/config";
import { RenderedStaticPage } from "@custom-site/page";
import { lookup } from "mime-types";
import { generateStatic } from "../generator";
import { getData } from "../getPage";
import { getDefaultConfig } from "../helpers";
import { init } from "../lifeCycle";
import { appStore } from "../store";
import { reloadScript } from "./reloadScript";
import { makeWebSocketServer } from "./wsServer";

const OBSERVE_FILE_EXTENSION = /\.(js|css|jsx|md|mdx|json)$/;

export const redirectToLocalFile = (filePath: string, res: http.ServerResponse): boolean => {
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.writeHead(200, { "Content-Type": lookup(filePath) || "text/plain" });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }
  return false;
};

/**
 * GenerateしたPageのkeyにマッチするようなパスに変換
 */
export const getRedirectPagePath = (pathname: string, option: DevelopOption): string => {
  const calcPath = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, pathname.length - 1) : pathname;
  if (option.basePath === "/") {
    return calcPath === "/" ? "/index" : calcPath;
  }
  if (calcPath === "/" || calcPath === option.basePath) {
    return path.join(calcPath, "index");
  }
  return calcPath;
};

/**
 * ローカルディレクトリにあるファイル名を探索できるようなパスに変換
 */
export const getRedirectLocalDirectoryPath = (dirname: string, pathname: string, option: DevelopOption): string => {
  if (pathname.startsWith(option.basePath)) {
    return path.join(dirname, pathname.slice(option.basePath.length));
  }
  return path.join(dirname, pathname);
};

const start = async (option: DevelopOption) => {
  init(option);
  let config = appStore.getState({ type: "config", id: "" }, option);
  const socketPort: number = await portfinder.getPortPromise({
    port: config.port - 2,
  });
  const initialSource = await getData(config);
  let socket: WebSocket;
  let generatedPages = await generateStatic(initialSource, config);

  const watchFiles: string[] = [config.source, config.layoutFile || "", config.customComponentsFile || ""];

  const watcher: chokidar.FSWatcher = chokidar.watch(watchFiles, {
    ignoreInitial: true,
  });

  makeWebSocketServer(socketPort, (res: WebSocket) => {
    socket = res;
  });

  const update = async (updateParams: { filename: string }) => {
    if (!socket) {
      return;
    }
    // TODO Side Effectを解消する
    if (config.configFile === updateParams.filename) {
      const updateConfig = getDefaultConfig(config.configFile);
      const state = { ...config, ...updateConfig };
      appStore.saveState({ type: "config", id: "", state });
      init(state);
    }
    config = appStore.getState({ type: "config", id: "" }, config);
    const updatedSource = await getData({ ...config, watcher: updateParams });
    generatedPages = await generateStatic(updatedSource, config);
    socket.send(JSON.stringify({ reload: true }));
  };

  watcher.on("change", async (filename: string) => {
    const base = path.basename(filename);
    const ext = path.extname(base);
    if (!OBSERVE_FILE_EXTENSION.test(ext)) {
      return;
    }
    // todo: handle this per file
    await update({ filename });
  });

  const app = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
    if (!req.url) {
      return;
    }
    const { pathname } = url.parse(req.url);
    if (!pathname) {
      return;
    }
    const filePath = path.join(config.source, pathname);
    // そのまま返せるファイルが有る場合は返す
    if (redirectToLocalFile(filePath, res)) {
      return;
    }
    // basepathが存在する場合
    if (redirectToLocalFile(getRedirectLocalDirectoryPath(config.source, pathname, config), res)) {
      return;
    }
    // 返せない場合はGeneratorから生成されたキャッシュを読みに行く
    const name = getRedirectPagePath(pathname, config);
    // tslint:disable:max-line-length
    const renderStaticPage: RenderedStaticPage | undefined = generatedPages.find((page: RenderedStaticPage) => page.name === name);
    if (renderStaticPage) {
      res.write(renderStaticPage.html);
      res.write(reloadScript(socketPort));
      res.end();
      return;
    }

    res.write("page not found: " + name);
    res.end();
    return;
  });

  try {
    const server = await app.listen(socketPort + 2);
    return server;
  } catch (err) {
    console.error(err);
    throw err;
  }
};

export { start as server };
