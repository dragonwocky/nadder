/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

import type { Context } from "../types.ts";
import {
  contentType,
  HTTPStatus,
  path,
  readableStreamFromReader,
} from "../deps.ts";

import { statusResponse } from "./status.ts";

const fileResponse = async (ctx: Context, filepath: string) => {
  try {
    const stat = await Deno.stat(filepath);
    if (stat.isDirectory) filepath = path.join(filepath, "index.html");
    const file = await Deno.open(filepath, { read: true });
    ctx.res.body = readableStreamFromReader(file);
    ctx.res.headers.set("content-type", contentType(path.basename(filepath))!);
    ctx.res.status = HTTPStatus.OK;
  } catch {
    statusResponse(ctx, HTTPStatus.NotFound);
  }
};

export { fileResponse };
