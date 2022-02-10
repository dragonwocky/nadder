/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

import type { Context } from "../types.ts";
import { contentType, HTTPStatus } from "../deps.ts";

const doctype = "<!DOCTYPE html>";

const htmlResponse = (ctx: Context, html: string) => {
  html = html.trim();
  ctx.res.body = html.startsWith(doctype) ? html : `${doctype}${html}`;
  ctx.res.status = HTTPStatus.OK;
  ctx.res.headers.set("content-type", contentType("html")!);
};

export { htmlResponse };
