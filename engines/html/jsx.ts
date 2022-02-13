/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

import { escapeHtml } from "../../util.ts";

declare global {
  namespace JSX {
    type IntrinsicElements = { [k: string]: JSX.Props };
    type Props = { [k: string]: string | number | boolean };
    type Node = JSX.Element | string | number | boolean | null | undefined;
    type Component = (props: Props, children: JSX.Node[]) => Element;
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

const renderToString = ($: JSX.Node, parentType = ""): string => {
  if ($ === undefined || $ === null) return "";
  if (typeof $ === "string") {
    return ["script", "style"].includes(parentType) ? $ : escapeHtml($);
  }
  if (typeof $ === "number" || typeof $ === "boolean") return $.toString();
  const attrs = Object.entries($.props)
      .filter(([_k, v]) => !!v || v === 0)
      .reduce((attrs, [k, v]) => {
        return `${attrs} ` +
          (v === true ? k : `${k}="${escapeHtml(v.toString())}"`);
      }, ""),
    innerHTML = $.children.map(($child) => renderToString($child, $.type)).join(
      "",
    );
  return selfClosingTags.includes($.type)
    ? `<${$.type}${attrs}/>`
    : `<${$.type}${attrs}>${innerHTML}</${$.type}>`;
};

const h = (
  type: JSX.Element["type"] | JSX.Component,
  props: JSX.Props,
  ...children: JSX.Node[]
): JSX.Element => {
  props = props ?? {};
  children = children.flat(Infinity);
  return type instanceof Function
    ? type(props, children)
    : { type, props, children };
};

// todo: experiment with frag vs fragfactory
const jsxFrag = (_: unknown, children: JSX.Node[]) => children;

const jsxToString = (
  $: JSX.Node | JSX.Node[],
): string => {
  if (Array.isArray($)) return $.map(($node) => renderToString($node)).join("");
  return renderToString($);
};

export { h, jsxFrag, jsxToString };
