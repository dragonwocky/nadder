import { walk } from "std/fs/mod.ts";
import { contentType } from "std/media_types/mod.ts";
import { type ConnInfo, Status, STATUS_TEXT } from "std/http/mod.ts";
import { compareEtag } from "std/http/util.ts";
import { extname, fromFileUrl, toFileUrl } from "std/path/mod.ts";
import { type VNode } from "vue";

import { ASSET_CACHE_KEY, BUILD_ID } from "../constants.ts";
import {
  type ErrorHandler,
  type HttpMethod,
  type Manifest,
  type Middleware,
  type PageProps,
  type Route,
  type StaticFile,
} from "./types.ts";

const createMethodNotAllowedRes = (patternMatchedMiddleware: Middleware[]) => {
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/405
  // if req method is invalid or if route exists but method handler does not
  const status = Status.MethodNotAllowed,
    allowedMethods = patternMatchedMiddleware.reduce((allowedMethods, mw) => {
      if (mw.isRouteOrFileHandler) allowedMethods.push(mw.method);
      return allowedMethods;
    }, [] as HttpMethod[]);
  return new Response(`${status} ${STATUS_TEXT[status]}`, {
    status,
    headers: new Headers({
      "allow": [...new Set(allowedMethods)].join(", "),
    }),
  });
};

const removeTrailingSlashFromReqPath = (req: Request): Response | undefined => {
    // e.g. /about/ -> /about
    const url = new URL(req.url);
    if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.slice(0, -1);
      return new Response(null, {
        status: Status.TemporaryRedirect,
        headers: new Headers({ "location": url.href }),
      });
    }
  },
  createUrlPatternFromPath = (
    path: string,
    matchAllSubRoutes?: boolean,
  ): URLPattern => {
    // from fresh/src/server/context.ts
    // (c) 2021 Luca Casonato under the MIT license
    // filter removes e.g. starting slash or double slash
    const parts = path.split("/").filter((part) => part);
    // <path>/index.<ext> is identical to <path>.<ext>
    if (["index", "_middleware"].includes(parts.at(-1)!)) parts.pop();
    let pattern = "/" + parts.map((segment) => {
      const isNamedGroup = segment.startsWith("[") && segment.endsWith("]"),
        isRepeatedGroup = isNamedGroup && segment.startsWith("[...");
      if (isRepeatedGroup) return `:${segment.slice(4, -1)}*`;
      if (isNamedGroup) return `:${segment.slice(1, -1)}`;
      return segment;
    }).join("/");
    if (matchAllSubRoutes) {
      if (pattern.endsWith("/")) pattern = pattern.slice(0, -1);
      pattern += "/*?";
    }
    return new URLPattern({ pathname: pattern });
  };

const handleableErrorStatuses = [
    Status.NotFound,
    Status.InternalServerError,
  ] as [Status.NotFound, Status.InternalServerError],
  getModulePathWithoutExt = (
    modulePath: string,
    { baseUrl, subDir }: { baseUrl: string; subDir: string },
  ) => {
    const localUrl = new URL(modulePath, baseUrl).href,
      withinSubDir = localUrl.startsWith(baseUrl + subDir),
      outsideSubDirErr =
        `"${modulePath}" is not within the "./${subDir}" project subdirectory.`;
    if (!withinSubDir) throw new TypeError(outsideSubDirErr);
    const path = localUrl.substring(baseUrl.length).substring(subDir.length),
      pathWithoutExt = path.substring(0, path.length - extname(path).length);
    return pathWithoutExt;
  },
  genMiddlewareFromRoutes = (
    routes: Manifest["routes"],
    { baseUrl, boundRender }: {
      baseUrl: string;
      boundRender: (component: VNode) => Promise<string>;
    },
  ) => {
    const middleware: Middleware[] = [],
      ignoredPaths = [
        "/_app",
        ...handleableErrorStatuses.map((status) => `/_${status}`),
      ];
    for (const [modulePath, _module] of Object.entries(routes)) {
      const pathWithoutExt = getModulePathWithoutExt(modulePath, {
        baseUrl,
        subDir: "routes",
      });
      if (pathWithoutExt.endsWith("/_middleware")) {
        const module = _module as { default: Middleware["handler"] };
        middleware.push({
          pattern: createUrlPatternFromPath(pathWithoutExt, true),
          method: "*",
          handler: module.default,
          isRouteOrFileHandler: false,
        });
      } else if (!ignoredPaths.includes(pathWithoutExt)) {
        // reassign module to make properties extensible + overrideable
        const module = { ..._module } as Route,
          pattern = module.pattern ?? createUrlPatternFromPath(pathWithoutExt),
          renderPage = async (props: PageProps) => {
            if (!module.default) return undefined;
            const html = await boundRender(module.default(props)),
              headers = new Headers({ "content-type": contentType("html") });
            return new Response(html, { status: Status.OK, headers });
          };

        // if page exists but has no handler to serve it, add one
        const defaultHandler: Route[HttpMethod] = async (_, ctx) =>
          (await ctx.render())!;
        if (module.default) module.GET ??= defaultHandler;

        for (const [method, handler] of Object.entries(module)) {
          if (["default", "pattern"].includes(method)) continue;
          middleware.push({
            pattern,
            method: method as HttpMethod,
            handler: (req, ctx) => {
              const params = pattern.exec(ctx.url)?.pathname.groups ?? {};
              return (handler as Route[HttpMethod])!(req, {
                params,
                render: (data) => renderPage({ url: ctx.url, params, data }),
                ...{ ...ctx, next: undefined },
              });
            },
            isRouteOrFileHandler: true,
          });
        }
      }
    }
    return middleware;
  },
  extractErrHandlersFromRoutes = (
    routes: Manifest["routes"],
    baseUrl: string,
  ) => {
    type HandleableErrorStatus = (typeof handleableErrorStatuses)[number];
    const statusPaths = handleableErrorStatuses.map((status) => `/_${status}`),
      errorHandlers: { [k in HandleableErrorStatus]?: ErrorHandler } = {};
    for (const [modulePath, _module] of Object.entries(routes)) {
      const pathWithoutExt = getModulePathWithoutExt(modulePath, {
        baseUrl,
        subDir: "routes",
      });
      if (!statusPaths.includes(pathWithoutExt)) continue;
      const module = _module as { default: ErrorHandler },
        status = +pathWithoutExt.slice(2) as HandleableErrorStatus;
      errorHandlers[status] = module.default;
    }
    return errorHandlers;
  };

const sortMiddlewarePriorityFirst = (middleware: Middleware[]) => {
    // from fresh/src/server/context.ts
    // (c) 2021 Luca Casonato under the MIT license
    // e.g. /admin/signin -> routes/_middleware
    // ctx.next() -> routes/admin/_middleware
    // ctx.next() -> routes/admin/signin
    return middleware.sort((mwA, mwB) => {
      // custom middleware should be called pre-route/file handler
      if (mwA.isRouteOrFileHandler && !mwB.isRouteOrFileHandler) return 1;
      if (!mwA.isRouteOrFileHandler && mwB.isRouteOrFileHandler) return -1;
      // scopes are called in order of specificity (least to greatest)
      const partsA = mwA.pattern.pathname.split("/"),
        partsB = mwB.pattern.pathname.split("/");
      for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const a = partsA[i],
          b = partsB[i];
        if (a === undefined) return -1;
        if (b === undefined) return 1;
        if (a === b) continue;
        const priorityA = a.startsWith(":") ? a.endsWith("*") ? 0 : 1 : 2,
          priorityB = b.startsWith(":") ? b.endsWith("*") ? 0 : 1 : 2;
        return Math.max(Math.min(priorityB - priorityA, 1), -1);
      }
      return 0;
    });
  },
  filterMiddlewareByPattern = (req: Request, middleware: Middleware[]) => {
    const url = new URL(req.url);
    return middleware.filter(({ pattern }) => pattern.exec(url));
  },
  filterMiddlewareByMethod = (req: Request, middleware: Middleware[]) => {
    const matchingMethods = [req.method, "*"];
    return middleware.filter(({ method }) => matchingMethods.includes(method));
  },
  composeMiddlewareHandlers = (
    middleware: Middleware[],
    { req, connInfo }: { req: Request; connInfo: ConnInfo },
  ) => {
    type MiddlewareContext = Parameters<Middleware["handler"]>[1];
    const handlers: (() => Response | Promise<Response>)[] = [],
      ctx: MiddlewareContext = {
        ...connInfo,
        next() {
          const handler = handlers.shift()!;
          return Promise.resolve(handler?.());
        },
        url: new URL(req.url),
        state: new Map(),
      };
    for (const mw of middleware) handlers.push(() => mw.handler(req, ctx));
    const handler = handlers.shift()!;
    return handler();
  };

const buildStaticFileCache = async (baseUrl: string) => {
    const staticFolder = new URL("./static", baseUrl),
      staticFiles: StaticFile[] = [];
    try {
      const encoder = new TextEncoder(),
        entries = walk(fromFileUrl(staticFolder), {
          includeFiles: true,
          includeDirs: false,
          followSymlinks: false,
        });
      for await (const entry of entries) {
        const localUrl = toFileUrl(entry.path),
          publicPath = localUrl.href.substring(staticFolder.href.length),
          encodedPath = encoder.encode(BUILD_ID + publicPath),
          hashedPath = await crypto.subtle.digest("SHA-1", encodedPath);
        staticFiles.push({
          localUrl,
          publicPath,
          sizeInBytes: (await Deno.stat(localUrl)).size,
          contentType: contentType(extname(publicPath)) ??
            "application/octet-stream",
          entityTag: Array.from(new Uint8Array(hashedPath))
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join(""),
        });
      }
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        // static folder missing, ignore
      } else throw err;
    }
    return staticFiles;
  },
  genMiddlewareFromStaticFiles = (staticFiles: StaticFile[]) => {
    const middleware: Middleware[] = [];
    for (const staticFile of staticFiles) {
      const pattern = new URLPattern({ pathname: staticFile.publicPath }),
        handler = async (req: Request) => {
          const url = new URL(req.url),
            assetCacheBustId = url.searchParams.get(ASSET_CACHE_KEY);
          // redirect prev. builds to uncached path
          if (assetCacheBustId && assetCacheBustId !== BUILD_ID) {
            url.searchParams.delete(ASSET_CACHE_KEY);
            return new Response(null, {
              status: Status.TemporaryRedirect,
              headers: new Headers({ "location": url.href }),
            });
          }
          // etags are used to test if cached resources have changed
          const etag = staticFile.entityTag,
            headers = new Headers({
              "content-type": staticFile.contentType,
              "vary": "If-None-Match",
              etag,
            });
          // cache assets with cache key matching build id for 1 year
          if (assetCacheBustId) {
            const cacheControl = "public, max-age=31536000, immutable";
            headers.set("cache-control", cacheControl);
          }
          // conditional request: only send response body if asset has changed
          // i.e. if etag (based on build id) doesn't match
          // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-None-Match
          // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/304
          const cachedEtag = req.headers.get("if-none-match");
          if (cachedEtag && compareEtag(etag, cachedEtag)) {
            return new Response(null, { status: Status.NotModified, headers });
          } else {
            // stream asset directly to client, no need to pre-buffer
            const file = await Deno.open(staticFile.localUrl);
            headers.set("content-length", String(staticFile.sizeInBytes));
            return new Response(file.readable, { headers });
          }
        };
      middleware.push({
        method: "GET",
        pattern,
        handler,
        isRouteOrFileHandler: true,
      });
    }
    return middleware;
  };

export {
  buildStaticFileCache,
  composeMiddlewareHandlers,
  createMethodNotAllowedRes,
  createUrlPatternFromPath,
  extractErrHandlersFromRoutes,
  filterMiddlewareByMethod,
  filterMiddlewareByPattern,
  genMiddlewareFromRoutes,
  genMiddlewareFromStaticFiles,
  removeTrailingSlashFromReqPath,
  sortMiddlewarePriorityFirst,
};
