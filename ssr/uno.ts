/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

import {
  modernNormalize,
  unoGenerator,
  unoPreset,
  unoTypography,
} from "../deps.ts";
import { reduceTemplate } from "../util.ts";

const expandUtilityGroups = (
  t: string | TemplateStringsArray | string[],
  ...s: unknown[]
) => {
  // e.g. font-(bold mono) m(y-4 x-3) dark:(font-blue hover:(p-8 h-full))
  // returns: font-bold font-mono my-4 mx-3 dark:font-blue dark:hover:p-8 dark:hover:h-full
  let className = typeof t === "string" ? t : reduceTemplate(t, ...s);
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

type UnoConfig = Parameters<typeof unoGenerator>[0];
type UnoGenerator = ReturnType<typeof unoGenerator>;
type GenerateOptions = Parameters<UnoGenerator["generate"]>[1];

const createUnoGenerator = (config: UnoConfig = {}) => {
  config.presets = config.presets ??
    [unoPreset({ dark: "class", variablePrefix: "uno-" }), unoTypography()];
  config.preflights = config.preflights ?? [{ getCSS: () => modernNormalize }];
  const engine = unoGenerator(config);
  return async (
    classList: string,
    options: GenerateOptions = { minify: true },
  ) => (await engine.generate(classList, options)).css;
};

export { createUnoGenerator, expandUtilityGroups };
