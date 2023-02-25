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
import type { Processor } from "../server.ts";
import type { Element } from "../server/deps.ts";
const cssResetUrl = "https://esm.sh/modern-normalize@1.1.0?css",
  cssReset = await fetch(cssResetUrl).then((res) => res.text());

let uno: UnoGenerator;
const shortcuts: StaticShortcut[] = [];

interface Config {
  extendDefaults: boolean;
  mode: "interpret" | "compile";
  compilePrefix: string;
  outputAs: "cssFile" | "styleTag";
  styleTagId: `#${string}`;
  cssFilePath: `${string}.css`;
}
const config: Config = {
    extendDefaults: true,
    mode: "interpret",
    compilePrefix: "uno-",
    outputAs: "cssFile",
    styleTagId: "#uno",
    cssFilePath: "/uno.css",
  },
  setup = (userConf: UserConfig & Partial<Config>) => {
    Object.assign(config, userConf);
    userConf.presets ??= [];
    userConf.preflights ??= [];
    userConf.shortcuts ??= [];
    if (config.extendDefaults) {
      userConf.presets.unshift(presetUno(), presetIcons(), presetTypography());
      userConf.preflights.unshift({ getCSS: () => cssReset });
    }
    uno = createGenerator(userConf);
    uno.config.shortcuts.push(...shortcuts);
  };

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
};

const interpret = (className: string) => {
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
  };

export default (async (document) => {
  if (!uno) setup({ extendDefaults: true });
  const classNames = [],
    classElems = document.querySelectorAll("[class]");
  for (const elem of [...classElems] as Element[]) {
    elem.className = config.mode === "compile"
      ? await compile(elem.className)
      : interpret(elem.className);
    classNames.push(elem.className);
  }
  const { css } = await uno.generate(classNames.join(" "));
  if (config.outputAs === "styleTag") {
    const styleElem = document.querySelector("style#uno");
    if (styleElem) styleElem.innerText += css;
    else document.head.innerHTML += `<style id="uno">${css}</style>`;
  } else {
    // ...
  }
}) as Processor;

export { setup };
