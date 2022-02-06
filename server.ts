/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

import { getCookies, HTTPStatus, stdServe } from "./deps.ts";
import { statusResponse } from "./response.ts";

export type HTTPMethod =
  | "GET"
  | "HEAD"
  | "POST"
  | "PATCH"
  | "PUT"
  | "DELETE"
  | "CONNECT"
  | "OPTIONS"
  | "TRACE";

interface RequestContext {
  method: HTTPMethod;
  ip: string | null;
  url: URL;
  body:
    | string
    | number
    | boolean
    | Record<string, unknown>
    | unknown[]
    | Blob
    | null
    | undefined;
  queryParams: URLSearchParams;
  pathParams: Record<string, unknown>;
  cookies: Record<string, string>;
  headers: Headers;
}
interface ResponseContext {
  body:
    | string
    | Blob
    | BufferSource
    | FormData
    | ReadableStream
    | URLSearchParams;
  status: number;
  headers: Headers;
}

export interface RouteContext {
  req: Readonly<RequestContext>;
  res: ResponseContext;
}
export interface SocketContext {
  req: Readonly<RequestContext>;
  socket: WebSocket;
}

type RouteHandler = (ctx: RouteContext) => void | Promise<void>;
const _routes: { [k in HTTPMethod]?: [URLPattern, RouteHandler][] } = {};
export const route = (
  method: HTTPMethod,
  route: string,
  handler: RouteHandler,
) => {
  if (!_routes[method]) _routes[method] = [];
  _routes[method]!.push([new URLPattern({ pathname: route }), handler]);
};

type SocketHandler = (ctx: SocketContext) => void | Promise<void>;
const _ws: [URLPattern, SocketHandler][] = [];
export const ws = (route: string, handler: SocketHandler) => {
  _ws.push([new URLPattern({ pathname: route }), handler]);
};

export const serve = (port = 3000) => {
  console.log("");
  console.log(`✨ server started at http://localhost:${port}/`);
  console.log("listening for requests...");
  console.log("");
  stdServe(async (req, conn) => {
    const url = new URL(req.url),
      ctx: { req: RequestContext; res: ResponseContext } = {
        req: {
          method: <HTTPMethod> req.method,
          ip: (<Deno.NetAddr> conn.remoteAddr).hostname,
          url,
          body: undefined,
          queryParams: new URLSearchParams(url.search),
          pathParams: {},
          cookies: getCookies(req.headers),
          headers: req.headers,
        },
        res: {
          body: "",
          status: HTTPStatus.OK,
          headers: new Headers(),
        },
      };

    try {
      console.log(`[${ctx.req.ip}] ${ctx.req.method} ${ctx.req.url.pathname}`);

      if (req.body) {
        const contentType = req.headers.get("content-type") ?? "",
          isJSON = contentType.includes("application/json"),
          isText = contentType.includes("text/plain"),
          isFormData =
            contentType.includes("application/x-www-form-urlencoded") ||
            contentType.includes("multipart/form-data");
        if (isJSON) {
          ctx.req.body = await req.json();
        } else if (isText) {
          ctx.req.body = await req.text();
        } else if (isFormData) {
          ctx.req.body = Object.fromEntries((await req.formData()).entries());
        } else ctx.req.body = await req.blob();
      }

      const ws = _ws.find(([pattern, _handler]) => {
        return pattern.test(ctx.req.url.href);
      });
      if (ws && req.headers.get("upgrade") === "websocket") {
        const { socket, response } = Deno.upgradeWebSocket(req),
          [pattern, handler] = ws;
        ctx.req.pathParams = pattern.exec(ctx.req.url.href)?.pathname.groups ??
          {};
        await handler({ req: ctx.req, socket });
        return response;
      }

      if (!_routes[ctx.req.method]) _routes[ctx.req.method] = [];
      const route = _routes[ctx.req.method]!.find(([pattern, _handler]) => {
        return pattern.test(ctx.req.url.href);
      });
      if (route) {
        const [pattern, handler] = route;
        ctx.req.pathParams = pattern.exec(ctx.req.url.href)?.pathname.groups ??
          {};
        await handler(ctx);
      } else statusResponse(ctx, HTTPStatus.NotFound);
    } catch (err) {
      console.error(`[${ctx.req.ip}]`, err);
      statusResponse(ctx, HTTPStatus.InternalServerError);
    }

    return new Response(ctx.res.body, {
      status: ctx.res.status,
      headers: ctx.res.headers,
    });
  }, { port });
};
