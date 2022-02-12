/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

import type { Context, Mutable } from "../types.ts";
import { getCookies, HTTPStatus, stdServe } from "../deps.ts";
import { statusResponse } from "../response/status.ts";

export const serve = (port = 3000, log = console.log) => {
  log("");
  log(`✨ server started at http://localhost:${port}/`);
  log("listening for requests...");
  log("");
  stdServe(async (req, conn) => {
    const url = new URL(req.url),
      ctx: Mutable<Context> = {
        req: {
          method: req.method as Context["req"]["method"],
          ip: (conn.remoteAddr as Deno.NetAddr).hostname,
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
        upgrade: {
          socket: undefined,
          channel: "",
        },
      };

    try {
      log(`[${ctx.req.ip}] ${ctx.req.method} ${ctx.req.url.pathname}`);

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

      // const ws = _ws.find(([pattern, _handler]) => {
      //   return pattern.test(ctx.req.url.href);
      // });
      // if (ws && req.headers.get("upgrade") === "websocket") {
      //   const { socket, response } = Deno.upgradeWebSocket(req),
      //     [pattern, handler] = ws;
      //   ctx.req.pathParams = pattern.exec(ctx.req.url.href)?.pathname.groups ??
      //     {};
      //   await handler({ req: ctx.req, socket });
      //   return response;
      // }

      // if (!_routes[ctx.req.method]) _routes[ctx.req.method] = [];
      // const route = _routes[ctx.req.method]!.find(([pattern, _handler]) => {
      //   return pattern.test(ctx.req.url.href);
      // });
      // if (route) {
      //   const [pattern, handler] = route;
      //   ctx.req.pathParams = pattern.exec(ctx.req.url.href)?.pathname.groups ??
      //     {};
      //   await handler(ctx);
      // } else statusResponse(ctx, HTTPStatus.NotFound);
    } catch (err) {
      log(`[${ctx.req.ip}]`, err);
      statusResponse(ctx, HTTPStatus.InternalServerError);
    }

    return new Response(ctx.res.body, {
      status: ctx.res.status,
      headers: ctx.res.headers,
    });
  }, { port });
};
