/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

import type { Context } from "../types.ts";
import { contentType, HTTPStatus } from "../deps.ts";

const jsonResponse = (ctx: Context, data: unknown) => {
  if (data instanceof Map || data instanceof Set) data = [...data];
  ctx.res.body = JSON.stringify(data, null, 2);
  ctx.res.status = HTTPStatus.OK;
  ctx.res.headers.set("content-type", contentType("json")!);
};

export { jsonResponse };
