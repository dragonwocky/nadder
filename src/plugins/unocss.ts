import {
  createGenerator,
  expandVariantGroup,
  type StaticShortcut,
  type UnoGenerator,
  type UserConfig,
} from "npm:@unocss/core@0.50.0";
import { presetIcons } from "npm:@unocss/preset-icons@0.50.0";
import { presetTypography } from "npm:@unocss/preset-typography@0.50.0";
import { presetUno } from "npm:@unocss/preset-uno@0.50.0";
import {
  createResponse,
  type Middleware,
  type Processor,
  useMiddleware,
} from "../server.ts";
import { contentType, type Element } from "../server/deps.ts";
const cssResetUrl = "https://esm.sh/modern-normalize@1.1.0?css",
  cssReset = await fetch(cssResetUrl).then((res) => res.text());

let uno: UnoGenerator;
const classCache: string[] = [],
  shortcuts: StaticShortcut[] = [],
  middleware: Middleware = { method: "GET" };

interface Config {
  extendDefaults: boolean;
  compileClasses: boolean;
  compilePrefix: string;
  outputMode: "cssFile" | "styleTag";
  styleTagId: `#${string}`;
  cssFilePath: `/${string}.css`;
}
const config: Config = {
    extendDefaults: true,
    compileClasses: false,
    compilePrefix: "uno-",
    outputMode: "cssFile",
    styleTagId: "#uno",
    cssFilePath: "/uno.css",
  },
  setup = (options: UserConfig & Partial<Config>) => {
    Object.assign(config, options);
    options.presets ??= [];
    options.preflights ??= [];
    options.shortcuts ??= [];
    if (config.extendDefaults) {
      options.presets.unshift(presetUno(), presetIcons(), presetTypography());
      options.preflights.unshift({ getCSS: () => cssReset });
    }
    uno = createGenerator(options);
    uno.config.shortcuts.push(...shortcuts);
    middleware.initialisesResponse = config.outputMode === "cssFile";
    middleware.pattern = new URLPattern({ pathname: config.cssFilePath });
  };
middleware.handler = async (_req, ctx) => {
  if (!uno || config.outputMode !== "cssFile") return ctx.next!();
  const css = await generate(...classCache);
  return createResponse(css, { "content-type": contentType(".css") });
};
useMiddleware(middleware);

const hash = (str: string) => {
    // https://github.com/unocss/unocss/blob/72b4306fe218b2469b54fa5ffe0e96444ab9f345/
    // packages/transformer-compile-class/src/index.ts#L80
    let hval = 0x811C9DC5;
    for (let i = 0, l = str.length; i < l; i++) {
      hval ^= str.charCodeAt(i);
      hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) +
        (hval << 24);
    }
    return (`00000${(hval >>> 0).toString(36)}`).slice(-6);
  },
  interpret = (className: string) => {
    // e.g. dark:(font-bold m(x-1 y-2) border-(red-200 1))
    // --> dark:font-bold dark:mx-1 dark:my-2 dark:border-red-200 dark:border-1
    const expandDepth = className.match(/[^\\]\(/g)?.length ?? 0;
    className = expandVariantGroup(className, ["-", ":", ""], expandDepth);
    return className.replace(/\s+/, " ");
  },
  compile = async (className: string) => {
    className = interpret(className);
    // e.g. dark:(font-bold m(x-1 y-2) border-(red-200 1)) my-classname
    // --> uno-qx2pmx my-classname
    const utilities: string[] = [],
      unknown: string[] = [],
      sort = className.split(/\s+/).map(async (token) => {
        if (await uno.parseToken(token)) utilities.push(token);
        else unknown.push(token);
      });
    await Promise.all(sort);
    if (utilities.length) {
      const classes = utilities.join(" "),
        alias = `${config.compilePrefix}${hash(classes)}`;
      shortcuts.push([alias, classes]);
      uno.config.shortcuts.push([alias, classes]);
      return `${[alias, ...unknown].join(" ")}`;
    } else return className;
  },
  generate = async (...classNames: string[]) => {
    const input = classNames.join(" "),
      opts = { minify: true };
    return (await uno.generate(input, opts)).css;
  };

const processor: Processor = async (document) => {
  if (!uno) setup({ extendDefaults: true });
  const classNames = [],
    classElems = document.querySelectorAll("[class]");
  for (const $el of [...classElems] as Element[]) {
    $el.className = config.compileClasses
      ? await compile($el.className)
      : interpret($el.className);
    classNames.push($el.className);
    classCache.push($el.className);
  }
  if (config.outputMode === "styleTag") {
    const id = config.styleTagId.replace(/^#+/, "");
    let $style = document.querySelector(`style#${id}`);
    if (!$style) {
      $style = document.createElement("style");
      $style.setAttribute("id", id);
      document.head.append($style);
    }
    $style.innerText += await generate(...classNames);
  } else {
    const href = "/" + config.cssFilePath.replace(/^\/+/, "");
    let $link = document.querySelector(`link[href="${href}"]`);
    if (!$link) {
      $link = document.createElement("link");
      $link.setAttribute("href", href);
      document.head.append($link);
    }
  }
};

export { type Config, processor, setup };
