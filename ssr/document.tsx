/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

/**
 * @jsx h
 * @jsxFrag jsxFrag
 */

import { createUnoGenerator, expandUtilityGroups } from "./uno.ts";
import { h, jsxFrag, jsxToString } from "./jsx.tsx";

const uno = createUnoGenerator();

const Document = async (
  title: string,
  children: JSX.Fragment,
  { lang = "en", head = <></> } = {},
) => {
  const classList: string[] = [],
    recurse = (_$: JSX.Node) => {
      if (!Object.prototype.hasOwnProperty.call(_$, "props")) return;
      const $ = _$ as JSX.Element, cls = $.props?.class?.toString() ?? "";
      if (cls) {
        $.props.class = expandUtilityGroups(cls);
        classList.push($.props.class);
      }
      if (!Object.prototype.hasOwnProperty.call(_$, "children")) return;
      $.children.forEach(recurse);
    };
  const body = [children].flat();
  body.forEach(recurse);
  const css = await uno(classList.join(" "));
  return "<!DOCTYPE html>" + jsxToString(
    <html lang={lang}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title}</title>
        <style>{css}</style>
        {head}
      </head>
      <body>{body}</body>
    </html>,
  );
};

export { Document };
