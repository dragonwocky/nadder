/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

import {
  initUno,
  modernNormalize,
  unoPreset,
  unoTypography,
} from "../../deps.ts";
import { reduceTemplate } from "../../util.ts";

const expandGroups = (className: string) => {
  // e.g. font-(bold mono) m(y-4 x-3) dark:(font-blue hover:(p-8 h-full))
  // returns: font-bold font-mono my-4 mx-3 dark:font-blue dark:hover:p-8 dark:hover:h-full
  const pattern = /([^\s'"`;>=]+)\(([^(]+?)\)/g,
    replace = () => {
      className = className.replaceAll(
        pattern,
        (_, variant, group) =>
          group.split(/\s+/).map((utility: string) => `${variant}${utility}`)
            .join(" "),
      );
    };
  while (pattern.test(className)) replace();
  return className;
};

type UnoConfig = Parameters<typeof initUno>[0];
type UnoGenerator = ReturnType<typeof initUno>;
type GenerateOptions = Parameters<UnoGenerator["generate"]>[1];

const unoInstance = (config: UnoConfig = {}) => {
  let cache = "", engine: undefined | UnoGenerator = undefined;
  config.presets = config.presets ??
    [unoPreset({ dark: "class", variablePrefix: "uno-" }), unoTypography()];
  config.preflights = config.preflights ?? [{ getCSS: () => modernNormalize }];
  return {
    uno: (t: TemplateStringsArray | string[], ...s: unknown[]) => {
      const className = expandGroups(reduceTemplate(t, ...s));
      cache += ` ${className}`;
      return className;
    },
    css: async (options: GenerateOptions = { minify: true }) => {
      if (!engine) engine = initUno(config);
      const { css } = await engine.generate(cache, options);
      return css;
    },
  };
};

export { unoInstance };
