import { HtmlMetaData, LinkHTMLAttributes } from "@custom-site/interfaces/lib/page";
import * as React from "react";
import { appendHash } from "./helpers";

export interface DryCheckParameter {
  href: string;
  isLocal: boolean;
}

const isIncludes = (params: DryCheckParameter[], searchElement: DryCheckParameter): boolean => {
  const hitParams = params.filter(param => param.isLocal === searchElement.isLocal && param.href === searchElement.href);
  hitParams.forEach(element => {
    console.error(`[Duplicated Error]: Scope: ${element.isLocal ? "local" : "global"}, src: ${element.href}`);
  });
  return hitParams.length > 0;
};

const getMakeTag = (dryParameter: DryCheckParameter[] = []) => (
  attributes: LinkHTMLAttributes | string,
  isLocal: boolean,
): JSX.Element | undefined => {
  if (typeof attributes === "string") {
    if (isIncludes(dryParameter, { href: attributes, isLocal })) {
      return;
    } else {
      dryParameter.push({
        href: attributes,
        isLocal,
      });
    }
    return <link href={appendHash(attributes)} key={attributes} rel="stylesheet" />;
  }
  if (!attributes.href) {
    return;
  }
  if (isIncludes(dryParameter, { href: attributes.href, isLocal })) {
    return;
  } else {
    dryParameter.push({
      href: attributes.href,
      isLocal,
    });
  }
  return <link {...{ ...attributes, href: appendHash(attributes.href) }} key={attributes.href} />;
};

export const generateLinkElements = ({ localLinks, globalLinks, extend }: HtmlMetaData): JSX.Element[] => {
  const elements: JSX.Element[] = [];
  const makeTag = getMakeTag();
  if (globalLinks) {
    globalLinks.forEach(attribute => {
      const tagElement = makeTag(attribute, false);
      if (tagElement) {
        elements.push(tagElement);
      }
    });
  }
  if (localLinks) {
    localLinks.forEach(attribute => {
      const tagElement = makeTag(attribute, true);
      if (tagElement) {
        elements.push(tagElement);
      }
    });
  }
  if (extend && extend.link) {
    extend.link.forEach(attribute => {
      const tagElement = makeTag(attribute, false);
      if (tagElement) {
        elements.push(tagElement);
      }
    });
  }
  return elements;
};
