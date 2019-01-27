// tslint:disable-next-line:no-reference
/// <reference path="../../typings/@custom-site/index.d.ts"/>

import { PostProps } from "@custom-site/page";
import * as React from "react";

const wrappedContent = (content?: React.ReactNode): React.ReactElement<any> => {
  return <div id="content">{content}</div>;
};

export const createBodyTemplateFunction = (props: PostProps) => (content?: React.ReactNode): React.ReactElement<any> => {
  const newContent = wrappedContent(content);
  return (
    <body id="custom-template">
      <h1>CustomTemplate: {props.site.title}</h1>
      <pre>{JSON.stringify(props, null, 2)}</pre>
      {newContent}
    </body>
  );
};