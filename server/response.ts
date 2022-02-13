/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

import type { Context } from "../types.ts";
import {
  contentType,
  HTTPStatus,
  HTTPStatusText,
  path,
  readableStreamFromReader,
} from "../deps.ts";

const statusResponse = (ctx: Context, status: HTTPStatus) => {
  ctx.res.body = `${status} ${HTTPStatusText.get(status) ?? ""}`;
  ctx.res.status = status;
};

const jsonResponse = (ctx: Context, data: unknown) => {
  if (data instanceof Map || data instanceof Set) data = [...data];
  ctx.res.body = JSON.stringify(data, null, 2);
  ctx.res.status = HTTPStatus.OK;
  ctx.res.headers.set("content-type", contentType("json")!);
};

const htmlResponse = (ctx: Context, html: string) => {
  html = html.trim();
  const doctype = "<!DOCTYPE html>";
  ctx.res.body = html.startsWith(doctype) ? html : `${doctype}${html}`;
  ctx.res.status = HTTPStatus.OK;
  ctx.res.headers.set("content-type", contentType("html")!);
};

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

const markResponseForDownload = (ctx: Context, filename = "") => {
  filename = filename ? `; filename="${filename}"` : "";
  ctx.res.headers.set("content-disposition", `attachment${filename}`);
};

export {
  fileResponse,
  htmlResponse,
  jsonResponse,
  markResponseForDownload,
  statusResponse,
};
