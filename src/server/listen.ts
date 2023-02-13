import { type ConnInfo, type ServeInit, Status } from "std/http/mod.ts";
import type { Context, Manifest, Middleware } from "./types.ts";
import { errorResponse, indexRoutes, indexStatic } from "./routes.ts";
import { getData, getMiddleware } from "./hooks.ts";

const handleRequest = (req: Request, connInfo: ConnInfo) => {
  try {
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
        return handler(req, { ...ctx, params });
      },
      ...connInfo,
    };

    // strip trailing slashes from url, e.g. /about/ -> .about
    if (ctx.url.pathname.length > 1 && ctx.url.pathname.endsWith("/")) {
      ctx.url.pathname = ctx.url.pathname.slice(0, -1);
      return Response.redirect(ctx.url);
    }

    // prepare middleware queue
    middleware = getMiddleware(ctx.url);
    if (!middleware.some((mw) => mw.initialisesResponse)) {
      return errorResponse(Status.NotFound);
    }
    middleware = middleware.filter((mw) => {
      return ["*", req.method].includes(mw.method!);
    });
    // if req method is invalid or if route exists but method handler does not
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/405
    if (!middleware.some((mw) => mw.initialisesResponse)) {
      //   const status = Status.MethodNotAllowed,
      //       new Headers({
      //   "allow": [...new Set(allowedMethods)].join(", "),
      // })
      // const allowedMethods = middleware.reduce((methods, mw) => {
      //   if (mw.method && mw.initialisesResponse) methods.push(mw.method);
      //   return methods;
      // }, [] as HttpMethod[]);
      return errorResponse(Status.MethodNotAllowed);
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
    return errorResponse(500);
  }
};

export { handleRequest };
