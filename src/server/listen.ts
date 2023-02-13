import { serve, type ServeInit, Status } from "std/http/mod.ts";
import type { Context, HttpMethod, Manifest, Middleware } from "../types.ts";
import {
  errorResponse,
  getData,
  getMiddleware,
  indexRoutes,
  indexStatic,
} from "./routes.ts";

const start = async (manifest: Manifest, serveInit: ServeInit = {}) => {
  manifest.ignorePattern ??= /\/(\.|_)/g;
  serveInit.onListen = serveInit.onListen ?? (({ hostname, port }) => {
    console.log(`Server listening on http://${hostname}:${port}/`);
  });

  await Promise.all([indexRoutes(manifest), indexStatic(manifest)]);
  return serve((req, connInfo) => {
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
  }, serveInit);
};

export { start };

/**
 * [] static file serving
 * [] static file processing
 * [x] route renderering
 * [] route preprocessing
 * [] route postprocessing
 * [x] ignored files
 * [] layouts
 * [] components
 * [1/2] error pages
 * [1/2] cache busting & etags
 * [x] route-level frontmatter data
 * [x] shared data (via middleware?)
 * [-] pretty urls (/about = /about/index.html = /about.html
 *    via \/about((\.html)|(\/index\.html))?)
 * [] multiple template engines (e.g. njk for vars, md for html?)
 * [] remote files (fwding)
 * [] interactive islands (via components + plugins?)
 * [] helpers/filters (e.g. for internationalisation)
 */
