/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

/**
 * @jsx h
 * @jsxFrag jsxFrag
 */

import { escapeHtml } from "../util.ts";

declare global {
  namespace JSX {
    type IntrinsicElements = { [k: string]: JSX.Props };
    type Props = { [k: string]: string | number | boolean | null | undefined };
    type Node = JSX.Element | JSX.Props[string];
    type Fragment = JSX.Node | JSX.Node[];
    type Component = (
      props: {
        [k: string]: JSX.Fragment | (() => JSX.Fragment);
      },
      children: JSX.Node[],
    ) => JSX.Element;
    interface Element {
      type: string;
      props: JSX.Props;
      children: JSX.Node[];
    }
  }
}

const selfClosingTags = [
  "area",
  "base",
  "basefont",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "keygen",
  "link",
  "meta",
  "param",
  "source",
  "spacer",
  "track",
  "wbr",
];

const renderToString = (
  $: JSX.Node,
  dangerouslySetInnerHTML = false,
): string => {
  if ($ === undefined || $ === null) return "";
  if (typeof $ === "string") return dangerouslySetInnerHTML ? $ : escapeHtml($);
  if (typeof $ === "number" || typeof $ === "boolean") return $.toString();
  dangerouslySetInnerHTML = dangerouslySetInnerHTML ||
    !!$.props.dangerouslySetInnerHTML ||
    ["style", "script"].includes(($ as JSX.Element).type);
  const attrs = Object.entries($.props)
      .filter(([_k, v]) => v || v === 0)
      .reduce((attrs, [k, _v]) => {
        const v = _v as string | number | true;
        return `${attrs} ` +
          (v === true ? k : `${k}="${escapeHtml(v.toString())}"`);
      }, ""),
    innerHTML = $.children.map(($child) =>
      renderToString($child, dangerouslySetInnerHTML)
    ).join("");
  return selfClosingTags.includes($.type)
    ? `<${$.type}${attrs}/>`
    : `<${$.type}${attrs}>${innerHTML}</${$.type}>`;
};

const h = (
  type: JSX.Element["type"] | JSX.Component,
  props: JSX.Props,
  ...children: JSX.Node[]
): JSX.Fragment => {
  props = props ?? {};
  children = children.flat(Infinity);
  return type instanceof Function
    ? type(props, children)
    : { type, props, children };
};

const jsxFrag = (_props: JSX.Props, children: JSX.Node[]) => children;

const jsxToString = (
  $: JSX.Fragment,
): string => {
  if (Array.isArray($)) return $.map(($node) => renderToString($node)).join("");
  return renderToString($);
};

export { h, jsxFrag, jsxToString };
