/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

import { gfm, gfmHtml, micromark } from "../deps.ts";
import { reduceTemplate } from "../util.ts";

const md = (t: TemplateStringsArray | string[], ...s: unknown[]) => {
  const value = reduceTemplate(t, s);
  return micromark(value, {
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()],
  });
};

export { md };
