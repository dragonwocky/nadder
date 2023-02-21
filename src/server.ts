import {
  type ConnInfo,
  type ErrorStatus,
  serve,
  type ServeInit,
  Status,
  STATUS_TEXT,
} from "std/http/mod.ts";
import {
  getData,
  getErrorHandler,
  getMiddleware,
  useComponent,
  useLayout,
} from "./server/hooks.ts";
import { indexRoutes, indexStatic, indexTemplates } from "./server/router.ts";
import type {
  Context,
  HttpMethod,
  Manifest,
  Middleware,
} from "./server/types.ts";

const start = async (manifest: Manifest, serveInit: ServeInit = {}) => {
  manifest.ignorePattern ??= /\/(\.|_)/g;
  serveInit.onListen = serveInit.onListen ?? (({ hostname, port }) => {
    console.log(`Server listening on http://${hostname}:${port}/`);
  });

  await Promise.all([
    indexTemplates(manifest, "components", useComponent),
    indexTemplates(manifest, "layouts", useLayout),
    indexRoutes(manifest),
    indexStatic(manifest),
  ]);
  return serve(async (req: Request, connInfo: ConnInfo) => {
    let middleware: Middleware[];
    const ctx: Context = {
        url: new URL(req.url),
        state: new Map(),
        params: {},
        next: () => {
          const mw = middleware.shift()!,
            params = mw.pattern?.exec(ctx.url)?.pathname.groups ?? {},
            handler = "handler" in mw ? mw.handler : mw.default;
          if (!middleware.length) delete ctx.next;
          return handler!(req, { ...ctx, params });
        },
        renderNotFound: () => renderErrorStatus(Status.NotFound),
        renderBadRequest: () => renderErrorStatus(Status.BadRequest),
        renderUnauthorized: () => renderErrorStatus(Status.Unauthorized),
        ...connInfo,
      },
      renderErrorStatus = async (status: ErrorStatus) => {
        const statusText = STATUS_TEXT[status],
          errorHandler = getErrorHandler(status, req);
        let document = `${status} ${statusText}`, type = "text/plain";
        if (errorHandler) {
          document = await errorHandler(ctx);
          type = ctx.state.get("contentType") as string ?? "text/html";
        }
        const headers = new Headers({ "content-type": String(type) });
        return new Response(document, { status, statusText, headers });
      };

    try {
      // strip trailing slashes from url, e.g. /about/ -> .about
      if (ctx.url.pathname.length > 1 && ctx.url.pathname.endsWith("/")) {
        ctx.url.pathname = ctx.url.pathname.slice(0, -1);
        return Response.redirect(ctx.url);
      }

      // prepare middleware queue
      middleware = getMiddleware(ctx.url);
      if (!middleware.some((mw) => mw.initialisesResponse)) {
        return ctx.renderNotFound();
      }
      middleware = middleware.filter((mw) => {
        return ["*", req.method].includes(mw.method!);
      });
      // if req method is invalid or if route exists but method handler does not
      // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/405
      if (!middleware.some((mw) => mw.initialisesResponse)) {
        const allowedMethods = getMiddleware(ctx.url).reduce((methods, mw) => {
            if (!mw.method || !mw.initialisesResponse) return methods;
            if (methods.includes(mw.method)) return methods;
            return [...methods, mw.method];
          }, [] as HttpMethod[]),
          notAllowedRes = await renderErrorStatus(Status.MethodNotAllowed);
        notAllowedRes.headers.set("allow", allowedMethods.join(", "));
        return notAllowedRes;
      }

      const data = Object.assign({}, ...getData(ctx.url));
      for (const key in data) ctx.state.set(key, data[key]);
      return ctx.next!();
    } catch (error) {
      console.error(
        `%c${error.name}: ${error.message}`,
        "color:red",
        `\n${error.stack?.split("\n").slice(1).join("\n")}`,
      );
      ctx.state.set("error", error);
      return renderErrorStatus(Status.InternalServerError);
    }
  }, serveInit);
};

export {
  useData,
  useMiddleware,
  useProcessor,
  useRenderer,
} from "./server/hooks.ts";
export type {
  Component,
  Context,
  Data,
  ErrorHandler,
  File,
  Handler,
  HttpMethod,
  Layout,
  Manifest,
  Middleware,
  Processor,
  Promisable,
  Renderer,
  Route,
} from "./server/types.ts";
export { start };

/**
 * [] interactive islands (via components + plugins?)
 * [] helpers/filters (e.g. for internationalisation)
 */
