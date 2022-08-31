import { ASSET_CACHE_KEY, BUILD_ID } from "../constants.ts";
import {
  compareEtag,
  contentType,
  dirname,
  extractFrontmatter,
  hasFrontmatter,
  Status,
} from "./deps.ts";
import { createNotFoundResponse } from "./errors.ts";
import {
  getPluginsInRegistrationOrder,
  getPluginsSortedBySpecificity,
} from "./plugins.ts";
import { walkDirectory } from "./reader.ts";
import type {
  Context,
  Frontmatter,
  Manifest,
  Route,
  RouteFile,
  StaticFile,
} from "./types.ts";

const indexStaticFiles = async (manifest: Manifest): Promise<StaticFile[]> => {
    const staticDirectory = new URL("./static", manifest.baseUrl),
      staticFiles = (await walkDirectory(staticDirectory))
        .filter((file) => {
          if (!manifest.ignorePattern) return true;
          const isIgnored = manifest.ignorePattern
            .test(file.location.pathname);
          return !isIgnored;
        }).map((file) => {
          const pathname = file.location.pathname
            .substring(dirname(manifest.baseUrl).length);
          return { ...file, pathname } as StaticFile;
        });
    return staticFiles;
  },
  processStaticFiles = async (staticFiles: StaticFile[]) => {
    const registeredPlugins = getPluginsInRegistrationOrder();
    for (const plugin of registeredPlugins) {
      if (!("staticFileProcessor" in plugin)) continue;
      staticFiles = await Promise.all(staticFiles.map((file) => {
        return plugin.staticFileProcessor!(file);
      }));
    }
    return staticFiles;
  },
  createStaticFileResponse = (
    req: Request,
    ctx: Context,
  ) => {
    const staticFile = ctx.file as StaticFile,
      assetCacheBustId = ctx.url.searchParams.get(ASSET_CACHE_KEY);
    // redirect old build requests to uncached path
    if (assetCacheBustId && assetCacheBustId !== BUILD_ID) {
      ctx.url.searchParams.delete(ASSET_CACHE_KEY);
      return new Response(null, {
        status: Status.TemporaryRedirect,
        headers: new Headers({ "location": ctx.url.href }),
      });
    }
    // etags are used to test if cached resources have changed
    const etag = staticFile.etag,
      headers = new Headers({
        "content-type": staticFile.type,
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
      headers.set("content-length", String(staticFile.size));
      return new Response(staticFile.raw, { status: Status.OK, headers });
    }
  };

const indexRoutes = async (manifest: Manifest): Promise<RouteFile[]> => {
    const textDecoder = new TextDecoder("utf-8"),
      routesDirectory = new URL("./routes", manifest.baseUrl),
      routeFiles = (await walkDirectory(routesDirectory))
        .filter((file) => {
          if (!manifest.ignorePattern) return true;
          const isIgnored = manifest.ignorePattern
              .test(file.location.pathname),
            isMiddleware = /_middleware\.(t|j)sx?$/
              .test(file.location.pathname);
          return !isIgnored && !isMiddleware;
        })
        .map((file) => {
          const pathname = file.location.pathname
              .substring(dirname(manifest.baseUrl).length),
            exports = manifest.routes[pathname] as Route | undefined;
          let content = textDecoder.decode(file.raw),
            frontmatter = undefined;
          if (!exports && hasFrontmatter(content)) {
            const { body, attrs } = extractFrontmatter<Frontmatter>(content);
            content = body;
            frontmatter = attrs;
          }
          return { ...file, content, frontmatter, exports };
        });
    return routeFiles;
  },
  renderRoute = async (ctx: Context) => {
    const routeFile = ctx.file as RouteFile,
      routeFileBasename = routeFile.location.pathname.split("/").at(-1)!,
      pluginsTargetingRoute = getPluginsSortedBySpecificity(routeFileBasename),
      registeredPlugins = getPluginsInRegistrationOrder(),
      renderEngine = pluginsTargetingRoute.find((p) => "routeRenderer" in p),
      routeHandlerKeys = [
        "*",
        "GET",
        "HEAD",
        "POST",
        "PUT",
        "DELETE",
        "CONNECT",
        "OPTIONS",
        "TRACE",
        "PATCH",
        "default",
        "pattern",
      ];
    if (!renderEngine) return undefined;
    // populate ctx.state
    let body: unknown = routeFile.content;
    if (routeFile.exports) {
      for (const k of Object.keys(routeFile.exports)) {
        if (routeHandlerKeys.includes(k)) continue;
        ctx.state.set(k, routeFile.exports[k]);
      }
      body = routeFile.exports.default?.(ctx);
    } else if (routeFile.frontmatter) {
      for (const k of Object.keys(routeFile.frontmatter)) {
        ctx.state.set(k, routeFile.frontmatter[k]);
      }
    }
    // apply plugins
    for (const plugin of pluginsTargetingRoute) {
      if (!("routePreprocessor" in plugin)) continue;
      body = await plugin.routePreprocessor!(body, ctx);
    }
    let html: string = await renderEngine.routeRenderer!(body, ctx);
    for (const plugin of registeredPlugins) {
      if (!("routePostprocessor" in plugin)) continue;
      html = await plugin.routePostprocessor!(html, ctx);
    }
    return html;
  },
  createRouteResponse = async (_req: Request, ctx: Context) => {
    const html = await renderRoute(ctx);
    if (!html) return createNotFoundResponse(ctx);
    return new Response(html, {
      status: Status.OK,
      headers: new Headers({ "content-type": contentType("html") }),
    });
  };

export {
  createRouteResponse,
  createStaticFileResponse,
  indexRoutes,
  indexStaticFiles,
  processStaticFiles,
  renderRoute,
};

/**
const createUrlPatternFromPath = (path: string): URLPattern => {
  // filter removes starting, ending and double slashes
  const parts = path.split("/").filter((part) => part),
    isIndex = parts.at(-1) === "index",
    isMiddleware = parts.at(-1) === "_middleware";
  if (isIndex || isMiddleware) parts.pop();
  let pattern = "/" + parts.map((segment) => {
    const isNamedGroup = segment.startsWith("[") && segment.endsWith("]"),
      isRepeatedGroup = isNamedGroup && segment.startsWith("[...");
    if (isRepeatedGroup) return `:${segment.slice(4, -1)}*`;
    if (isNamedGroup) return `:${segment.slice(1, -1)}`;
    return segment;
  }).join("/");
  if (isMiddleware) pattern += "/*?";
  return new URLPattern({ pathname: pattern });
};

export { indexRouteFiles, processRoute };

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
};
**/
