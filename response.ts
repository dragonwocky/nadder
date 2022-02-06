/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

import { RouteContext } from "./server.ts";
import { jsxToString } from "./ssr.tsx";
import {
  contentType,
  HTTPStatus,
  HTTPStatusText,
  path,
  readableStreamFromReader,
} from "./deps.ts";

export const jsonResponse = (ctx: RouteContext, data: unknown) => {
  if (data instanceof Map || data instanceof Set) data = [...data];
  ctx.res.body = JSON.stringify(data, null, 2);
  ctx.res.status = HTTPStatus.OK;
  ctx.res.headers.set("content-type", contentType("json")!);
};

export const statusResponse = (ctx: RouteContext, status: number) => {
  ctx.res.body = `${status} ${HTTPStatusText.get(status) ?? ""}`;
  ctx.res.status = status;
};

export const htmlResponse = (ctx: RouteContext, html: string) => {
  ctx.res.body = html;
  ctx.res.status = HTTPStatus.OK;
  ctx.res.headers.set("content-type", contentType("html")!);
};

export const jsxResponse = (ctx: RouteContext, $: JSX.Element) => {
  htmlResponse(ctx, `<!DOCTYPE html>${jsxToString($)}`);
};

export const fileResponse = async (ctx: RouteContext, filepath: string) => {
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
