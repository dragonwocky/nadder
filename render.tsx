/*! mit license (c) dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/) */

/**
 * @jsx h
 * @jsxFrag jsxFrag
 */

import {
  createGenerator,
  iconifyCollections,
  presetIcons,
  presetWind,
} from "./deps.ts";
import { transform } from "./transform.ts";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [k: string]: unknown;
    }
    type Props = { [k: string]: unknown };
    type Children = unknown[];
    interface Element {
      type: string;
      props: Props;
      children: Children;
    }
  }
}

// conditionals
const isElement = ($: unknown): $ is JSX.Element => {
    if (!$) return false;
    const hasType = Object.prototype.hasOwnProperty.call($, "type"),
      hasProps = Object.prototype.hasOwnProperty.call($, "props"),
      hasChildren = Object.prototype.hasOwnProperty.call($, "children"),
      isElement = hasType && hasProps && hasChildren;
    return isElement;
  },
  isSelfClosingTag = (tag: string) => {
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
    ].includes(tag);
  },
  shouldDangerouslySetInnerHTML = ($: JSX.Element) => {
    return !!$.props.dangerouslySetInnerHTML ||
      ["style", "script"].includes($.type);
  };

// transformers
const escapeHtml = (str: string) => {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/'/g, "&#39;")
      .replace(/"/g, "&quot;")
      .replace(/\\/g, "&#x5C;");
  },
  expandUtilityGroups = (cls: string) => {
    // e.g. "font-(bold mono) m(y-[calc(10px+1em)] x-3) dark:(font-blue hover:(p-8 h-full))"
    // -> "font-bold font-mono my-[calc(10px+1em)] mx-3 dark:font-blue dark:hover:p-8 dark:hover:h-full"
    cls = cls.replaceAll(/\s+/g, " ").trim();
    type Replacer = Parameters<typeof String.prototype.replaceAll>[1];
    const replaceAll = (pattern: RegExp, replacer: Replacer) => {
      while (pattern.test(cls)) cls = cls.replaceAll(pattern, replacer);
    };
    // escape () within []
    replaceAll(
      /\[[^\]]*?(?<!\\)(\(|\))(?=[^\]]*?])/g,
      (match) => match.replaceAll(/(?<!\\)(\(|\))/g, `\\$&`),
    );
    // prefix utilities, ignore spaces within []
    replaceAll(
      /([^\s\('"`;>=\\]+)\((([^(]|(?<=\\)\()*?[^\\])\)/g,
      (_match, prefix, g) => {
        return g.split(/(?<!\[[^\]]*?)\s+(?![^\[]*?\])/)
          .map((u: string) => prefix + u).join(" ");
      },
    );
    // unescape () within []
    cls = cls.replaceAll(/\\(\(|\))/g, (_match, bracket) => bracket);
    return cls;
  },
  asyncJsxToSync = async ($: unknown) => {
    $ = await $;
    if (Array.isArray($)) {
      $ = await Promise.all($.map(asyncJsxToSync));
    } else if (isElement($)) {
      $.type = await $.type;
      $.children = await Promise.all($.children.map(asyncJsxToSync));
      for (const key in $.props) $.props[key] = await $.props[key];
    }
    return $;
  },
  attrsToString = (props: JSX.Props) => {
    return Object.entries(props)
      .filter(([_k, v]) => v || v === 0)
      .reduce((attrs, [k, _v]) => {
        const v = _v as string | number | true;
        return `${attrs} ` +
          (v === true ? k : `${k}="${escapeHtml(v.toString())}"`);
      }, "");
  },
  primitiveToString = ($: unknown, escaped = false) => {
    if ($ === undefined || $ === null) return "";
    if (typeof $ === "number" || typeof $ === "boolean") return $.toString();
    if (typeof $ === "string") return escaped ? escapeHtml($) : $;
    return escaped ? escapeHtml(JSON.stringify($)) : JSON.stringify($);
  },
  jsxToString = ($: unknown, dangerouslySetInnerHTML = false): string => {
    if (isElement($) && $.type === "") $ = $.children;
    if (Array.isArray($)) {
      const innerHTML = $.map(($$) => jsxToString($$, dangerouslySetInnerHTML))
        .join("");
      return innerHTML;
    } else if (isElement($)) {
      dangerouslySetInnerHTML = dangerouslySetInnerHTML ||
        shouldDangerouslySetInnerHTML($);
      let innerHTML = $.children.map(($$) =>
        jsxToString($$, dangerouslySetInnerHTML)
      ).join("");
      const openingTag = `${$.type}${attrsToString($.props)}`,
        closingTag = $.type;
      if ($.type === "script") {
        const ts = typeof $.props.lang === "string" &&
          ["ts", "typescript"].includes($.props.lang.toLowerCase());
        innerHTML = transform(ts ? "ts" : "js", innerHTML);
      }
      if ($.type === "style") innerHTML = transform("css", innerHTML);
      return isSelfClosingTag($.type)
        ? `<${openingTag}/>`
        : `<${openingTag}>${innerHTML}</${closingTag}>`;
    } else return primitiveToString($);
  };

// factories
const h = (
    type: JSX.Element["type"] | CallableFunction,
    props: JSX.Props,
    ...children: JSX.Children
  ): JSX.Element => {
    props = props ?? {};
    children = (children ?? []).flat(Infinity)
      .reduce<JSX.Children>((childList, $$) => {
        const isDuplicate = isElement($$) && childList.includes($$),
          isValueless = $$ === undefined || $$ === null,
          isFragment = isElement($$) && $$.type === "";
        if (!isDuplicate && !isValueless) {
          if (isFragment) childList.push(...$$.children);
          else childList.push($$);
        }
        return childList;
      }, []);
    const $ = type instanceof Function
      ? type(props, children)
      : { type, props, children };
    return $;
  },
  jsxFrag = (_props: JSX.Props, children: JSX.Children) => ({
    type: "",
    props: {},
    children,
  });

// configuration
let unoTheme: unknown = undefined;
const setTheme = (theme: unknown) => {
  unoTheme = theme;
  return unoTheme;
};

// renderers
const renderStylesheet = async (className: string) => {
    const uno = createGenerator({
        presets: [
          presetWind({ dark: "class", variablePrefix: "uno-" }),
          presetIcons(await iconifyCollections("twemoji", "ph")),
        ],
        theme: unoTheme,
      }),
      { css } = await uno.generate(className, //
      { id: undefined, scope: undefined, minify: true });
    return css;
  },
  renderIsland = async ($: JSX.Element | JSX.Element[]) => {
    let className = "";
    const Island = <>{await asyncJsxToSync($)}</>,
      recurseNodes = ($: unknown) => {
        if (!isElement($)) return;
        if ($.props.class) {
          $.props.class = expandUtilityGroups(primitiveToString($.props.class));
          className += ` ${$.props.class}`;
        }
        for (const $child of $.children) recurseNodes($child);
      };
    recurseNodes(Island);
    Island.children.unshift(<style>{await renderStylesheet(className)}</style>);
    return jsxToString(Island);
  },
  renderDocument = async ($: JSX.Element | JSX.Element[]) => {
    const Document = (
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title></title>
        </head>
        <body>{await asyncJsxToSync($)}</body>
      </html>
    );

    let className = "";
    const magicElements: Map<string, JSX.Element> = new Map(),
      recurseNodes = ($: unknown, $parent?: JSX.Element) => {
        if (!isElement($)) return;
        for (const type of ["html", "head", "title", "body"]) {
          if ($.type !== type) continue;
          if (magicElements.has(type)) {
            const $magic = magicElements.get(type)!;
            $magic.props = { ...$magic.props, ...$.props };
            $magic.children.push(...$.children);
            $parent?.children.splice($parent.children.indexOf($), 1);
          } else magicElements.set(type, $);
        }
        if ($.props.class) {
          $.props.class = expandUtilityGroups(primitiveToString($.props.class));
          className += ` ${$.props.class}`;
        }
        for (const $child of [...$.children]) recurseNodes($child, $);
      };
    recurseNodes(Document);

    const Head = magicElements.get("head")!;
    Head.children.push(<style>{await renderStylesheet(className)}</style>);
    return `<!DOCTYPE html>${jsxToString(Document)}`;
  };

export {
  asyncJsxToSync,
  escapeHtml,
  h,
  isElement,
  jsxFrag,
  jsxToString,
  primitiveToString,
  renderDocument,
  renderIsland,
  setTheme,
};
