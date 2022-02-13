export * as path from "https://deno.land/std@0.125.0/path/mod.ts";
export { readableStreamFromReader } from "https://deno.land/std@0.125.0/streams/mod.ts";

export { serve as stdServe } from "https://deno.land/std@0.125.0/http/server.ts";
export {
  Status as HTTPStatus,
  STATUS_TEXT as HTTPStatusText,
} from "https://deno.land/std@0.125.0/http/http_status.ts";
export { contentType } from "https://deno.land/x/media_types@v2.12.1/mod.ts";
export {
  deleteCookie,
  getCookies,
  setCookie,
} from "https://deno.land/std@0.125.0/http/cookie.ts";
export type { Cookie } from "https://deno.land/std@0.125.0/http/cookie.ts";

export const modernNormalize =
  `/*! modern-normalize v1.1.0 | MIT License | https://github.com/sindresorhus/modern-normalize */*,::after,::before{box-sizing:border-box}html{-moz-tab-size:4;tab-size:4}html{line-height:1.15;-webkit-text-size-adjust:100%}body{margin:0}body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif,'Apple Color Emoji','Segoe UI Emoji'}hr{height:0;color:inherit}abbr[title]{text-decoration:underline dotted}b,strong{font-weight:bolder}code,kbd,pre,samp{font-family:ui-monospace,SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;font-size:1em}small{font-size:80%}sub,sup{font-size:75%;line-height:0;position:relative;vertical-align:baseline}sub{bottom:-.25em}sup{top:-.5em}table{text-indent:0;border-color:inherit}button,input,optgroup,select,textarea{font-family:inherit;font-size:100%;line-height:1.15;margin:0}button,select{text-transform:none}[type=button],[type=reset],[type=submit],button{-webkit-appearance:button}::-moz-focus-inner{border-style:none;padding:0}:-moz-focusring{outline:1px dotted ButtonText}:-moz-ui-invalid{box-shadow:none}legend{padding:0}progress{vertical-align:baseline}::-webkit-inner-spin-button,::-webkit-outer-spin-button{height:auto}[type=search]{-webkit-appearance:textfield;outline-offset:-2px}::-webkit-search-decoration{-webkit-appearance:none}::-webkit-file-upload-button{-webkit-appearance:button;font:inherit}summary{display:list-item}`;

export { createGenerator as initUno } from "https://esm.sh/@unocss/core@0.24.2";
export { default as unoPreset } from "https://esm.sh/@unocss/preset-mini@0.24.2";
export { presetTypography as unoTypography } from "https://esm.sh/@unocss/preset-typography@0.24.2";

export { micromark } from "https://esm.sh/micromark@3.0.10";
export { gfm, gfmHtml } from "https://esm.sh/micromark-extension-gfm@2.0.1";

export * as postgres from "https://deno.land/x/postgres@v0.15.0/mod.ts";
