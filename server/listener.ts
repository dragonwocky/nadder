/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

import type { Context, Mutable, RequestMethod } from "../types.ts";
import { getCookies, HTTPStatus, stdServe } from "../deps.ts";
import { statusResponse } from "../responses/status.ts";
import { getRoute } from "./router.ts";
import { callMiddleware } from "./middleware.ts";

const listenAndServe = (port = 3000, log = console.log) => {
  log("");
  log(`✨ server started at http://localhost:${port}/`);
  log("listening for requests...");
  log("");
  stdServe(async (req, conn) => {
    let override: Response | undefined, socket: WebSocket | undefined;

    const url = new URL(req.url),
      ctx: Mutable<Context> = {
        req: {
          method: req.method as RequestMethod,
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
          sent: false,
        },
        upgrade: {
          available: req.headers.get("upgrade") === "websocket",
          socket: () => {
            if (!ctx.upgrade.available) return undefined;
            if (socket || ctx.res.sent) return socket;
            const upgrade = Deno.upgradeWebSocket(req);
            socket = upgrade.socket;
            override = upgrade.response;
            return socket;
          },
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
          ctx.req.body = await req.formData();
        } else ctx.req.body = await req.blob();
      }

      const route = getRoute(ctx.req.method, ctx.req.url.href);
      if (route) {
        ctx.req.pathParams = route.pathParams;
        await route.callback(ctx);
      } else statusResponse(ctx, HTTPStatus.NotFound);

      await callMiddleware(ctx);
    } catch (err) {
      log(`[${ctx.req.ip}]`, err);
      statusResponse(ctx, HTTPStatus.InternalServerError);
    }

    (ctx.res as Mutable<Context["res"]>).sent = true;
    Object.freeze(ctx.res);
    return override ?? new Response(ctx.res.body, {
      status: ctx.res.status,
      headers: ctx.res.headers,
    });
  }, { port });
};

export { listenAndServe };
