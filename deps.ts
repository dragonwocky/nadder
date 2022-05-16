/*! mit license (c) dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/) */

export { serve } from "https://deno.land/std@0.138.0/http/server.ts";
export {
  Status as HTTPStatus,
  STATUS_TEXT as HTTPStatusText,
} from "https://deno.land/std@0.138.0/http/http_status.ts";
export { contentType } from "https://deno.land/x/media_types@v3.0.2/mod.ts";

export {
  deleteCookie,
  getCookies,
  setCookie,
} from "https://deno.land/std@0.138.0/http/cookie.ts";
export type { Cookie } from "https://deno.land/std@0.138.0/http/cookie.ts";

export { readableStreamFromReader } from "https://deno.land/std@0.138.0/streams/mod.ts";
export { basename } from "https://deno.land/std@0.138.0/path/mod.ts";

export * as swc from "https://deno.land/x/swc@0.1.4/mod.ts";

export { default as postcss } from "https://deno.land/x/postcss@8.4.13/mod.js";
export { default as autoprefixer } from "https://esm.sh/autoprefixer@10.4.4";
export { default as selectorParser } from "https://esm.sh/postcss-selector-parser@6.0.10";
export { default as valueParser } from "https://esm.sh/postcss-value-parser@4.2.0";

export { micromark } from "https://esm.sh/micromark@3.0.10";
export { gfm, gfmHtml } from "https://esm.sh/micromark-extension-gfm@2.0.1";
export { math, mathHtml } from "https://esm.sh/micromark-extension-math@2.0.2";
export { default as hljs } from "https://esm.sh/highlight.js@11.5.0";
export type { HtmlExtension } from "https://esm.sh/micromark-util-types@1.0.2/index.d.ts";

export { createGenerator } from "https://cdn.skypack.dev/@unocss/core@0.33.4";
export { default as presetWind } from "https://cdn.skypack.dev/@unocss/preset-wind@0.33.4";
export { default as presetTypography } from "https://cdn.skypack.dev/@unocss/preset-typography@0.33.4";
export { default as presetIcons } from "https://cdn.skypack.dev/@unocss/preset-icons@0.33.4";
