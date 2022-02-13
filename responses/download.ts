/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

import type { Context } from "../types.ts";

const markResponseForDownload = (ctx: Context, filename = "") => {
  filename = filename ? `; filename="${filename}"` : "";
  ctx.res.headers.set("content-disposition", `attachment${filename}`);
};

export { markResponseForDownload };
