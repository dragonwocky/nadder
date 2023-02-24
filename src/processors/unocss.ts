import {
  createGenerator,
  expandVariantGroup,
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

interface ProcessorConfig {
  extendDefaults?: boolean;
  /**
   * ...
   */
  compileClasses?: boolean;
  /**
   * ...
   */
  inlineStyles?: boolean;
}

let uno: UnoGenerator,
  _compileClasses = false,
  _inlineStyles = true;
const setup = (config: UserConfig & ProcessorConfig) => {
  _compileClasses = config.compileClasses ?? _compileClasses;
  _inlineStyles = config.inlineStyles ?? _inlineStyles;
  config.extendDefaults ??= true;
  config.presets ??= [];
  config.preflights ??= [];
  if (config.extendDefaults) {
    config.presets.unshift(presetUno(), presetIcons(), presetTypography());
    config.preflights.unshift({ getCSS: () => cssReset });
  }
  uno = createGenerator(config);
};

const interpret = (className: string) => {
    // e.g. dark:(font-bold m(x-1 y-2) border-(red-200 1))
    // --> dark:font-bold dark:mx-1 dark:my-2 dark:border-red-200 dark:border-1
    const expandDepth = className.match(/[^\\]\(/g)?.length ?? 0;
    className = expandVariantGroup(className, ["-", ":", ""], expandDepth);
    return className.replace(/\s+/, " ");
  },
  compile = (className: string) => {
    className = interpret(className);
    // ...
    return className;
  };

export default (async (document) => {
  if (!uno) setup({ extendDefaults: true });
  const classNames = [],
    classElems = document.querySelectorAll("[class]");
  for (const elem of [...classElems] as Element[]) {
    elem.className = _compileClasses
      ? compile(elem.className)
      : interpret(elem.className);
    classNames.push(elem.className);
  }
  const { css } = await uno.generate(classNames.join(" "));
  if (_inlineStyles) {
    const styleElem = document.querySelector("style#uno");
    if (styleElem) styleElem.innerText += css;
    else document.head.innerHTML += `<style id="uno">${css}</style>`;
  } else {
    // ...
  }
}) as Processor;

export { setup };
