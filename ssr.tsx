/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

/**
 * @jsx h
 * @jsxFrag jsxFrag
 */

import { StyleSheet, WindiProcessor } from "./deps.ts";
import { escapeHtml, reduceTemplate } from "./util.ts";

declare global {
  namespace JSX {
    type IntrinsicElements = { [k: string]: JSX.Props };
    type Props = { [k: string]: string | number | boolean };
    type Node = JSX.Element | string | number | boolean | undefined;
    type Component = (props: Props, children: JSX.Node[]) => Element;
    interface Element {
      type: string;
      props: JSX.Props;
      children: JSX.Node[];
    }
  }
}

export const h = (
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

export const jsxFrag = (_: unknown, children: JSX.Node[]) => children;

const renderToString = ($: JSX.Node, parentType = ""): string => {
  if (!$) return "";
  if (typeof $ === "string") {
    return ["script", "style"].includes(parentType) ? $ : escapeHtml($);
  }
  if (typeof $ === "number" || typeof $ === "boolean") return $.toString();
  const attrs = Object.entries($.props)
      .filter(([k, v]) => !!v || v === 0)
      .reduce((attrs, [k, v]) => {
        return `${attrs} ` +
          (v === true ? k : `${k}="${escapeHtml(v.toString())}"`);
      }, ""),
    innerHTML = $.children.map(($child) => renderToString($child, $.type)).join(
      "",
    );
  return [
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
    ].includes($.type)
    ? `<${$.type}${attrs}/>`
    : `<${$.type}${attrs}>${innerHTML}</${$.type}>`;
};
export const jsxToString = (
  $: JSX.Node | JSX.Node[],
): string => {
  if (Array.isArray($)) return $.map(($node) => renderToString($node)).join("");
  return renderToString($);
};

const preflight =
  `/*! modern-normalize v1.1.0 | MIT License | https://github.com/sindresorhus/modern-normalize */*,::after,::before{box-sizing:border-box}html{-moz-tab-size:4;tab-size:4}html{line-height:1.15;-webkit-text-size-adjust:100%}body{margin:0}body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif,'Apple Color Emoji','Segoe UI Emoji'}hr{height:0;color:inherit}abbr[title]{text-decoration:underline dotted}b,strong{font-weight:bolder}code,kbd,pre,samp{font-family:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;font-size:1em}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}sub{bottom:-.25em}sup{top:-.5em}table{text-indent:0;border-color:inherit}button,input,optgroup,select,textarea{font-family:inherit;font-size:100%;line-height:1.15;margin:0}button,select{text-transform:none}[type=button],[type=reset],[type=submit],button{-webkit-appearance:button}::-moz-focus-inner{border-style:none;padding:0}:-moz-focusring{outline:1px dotted ButtonText}:-moz-ui-invalid{box-shadow:none}legend{padding:0}progress{vertical-align:baseline}::-webkit-inner-spin-button,::-webkit-outer-spin-button{height:auto}[type=search]{-webkit-appearance:textfield;outline-offset:-2px}::-webkit-search-decoration{-webkit-appearance:none}::-webkit-file-upload-button{-webkit-appearance:button;font:inherit}summary{display:list-item}`;

export const windiInstance = (
  mode: "interpret" | "compile" = "interpret",
  config: Record<string, unknown> = {},
) => {
  const processor = new WindiProcessor();
  config = processor.loadConfig(config);
  let stylesheet = new StyleSheet();
  return {
    tw: (t: TemplateStringsArray | string[], ...s: unknown[]) => {
      const className = reduceTemplate(t, ...s);
      if (mode === "compile") {
        const compiled = processor.compile(className, config.prefix as string);
        stylesheet = stylesheet.extend(compiled.styleSheet);
        return [compiled.className, ...compiled.ignored].join(" ");
      }
      const interpreted = processor.interpret(className);
      stylesheet = stylesheet.extend(interpreted.styleSheet);
      return [...interpreted.success, ...interpreted.ignored].join(" ");
    },
    sheet: () => (
      <style>
        {config.preflight === false ? "" : preflight}
        {stylesheet.sort().combine().build(true)}
      </style>
    ),
  };
};
