import {
  extract as extractFrontmatter,
  test as hasFrontmatter,
} from "std/encoding/front_matter/any.ts";
import { parse as parseToml } from "std/encoding/toml.ts";
import { parse as parseYaml } from "std/encoding/yaml.ts";
import {
  type ErrorStatus,
  isErrorStatus,
  Status,
} from "std/http/http_status.ts";
import { extname } from "std/path/mod.ts";
import { BUILD_ID, INTERNAL_PREFIX } from "../constants.ts";
import {
  getLayout,
  getLayoutData,
  getProcessors,
  getRenderer,
  getRenderersByExtension,
  useData,
  useErrorHandler,
  useLayout,
  useMiddleware,
} from "./hooks.ts";
import { walkDirectory } from "./reader.ts";
import {
  type _RenderFunction,
  type Context,
  type Data,
  type ErrorHandler,
  type Handler,
  type HttpMethod,
  HttpMethods,
  type Manifest,
  type Middleware,
  type Route,
} from "./types.ts";

const pathToPattern = (path: string): URLPattern => {
    // if (ignoreExtension) path = path.slice(0, -extname(path).length);
    return new URLPattern({
      pathname: path.split("/")
        .map((part) => {
          if (part.endsWith("]")) {
            // repeated group e.g. /[...path] matches /path/to/file/
            if (part.startsWith("[...")) return `:${part.slice(4, -1)}*`;
            // named group e.g. /user/[id] matches /user/6448
            if (part.startsWith("[")) `:${part.slice(1, -1)}`;
          }
          return part;
        }).join("/")
        // /route/index is equiv to -> /route
        .replace(/\/index$/, "")
        // /*? matches all nested routes
        .replace(/\/_(middleware|data)$/, "/*?")
        // ensure starting slash and remove repeat slashes
        .replace(/(^\/*|\/+)/g, "/"),
    });
  },
  _renderHtml = async (ctx: Context, render: _RenderFunction) => {
    let content = await render?.(ctx) ?? "";
    const engines = (ctx.state.get("renderEngines") as string[] ?? [])
      .map(getRenderer).filter((engine) => engine);
    for (const engine of engines) content = await engine!(content, ctx);
    const layout = getLayout(ctx.state.get("layout") as string);
    if (layout) {
      ctx.state.set("content", content);
      ctx.state.set("layout", layout.layout);
      ctx.state.set("renderEngines", layout.renderEngines);
      content = await _renderHtml(ctx, layout.default);
    }
    return String(content);
  },
  renderHtml = (ctx: Context, render: _RenderFunction) => {
    // assign layout data only at start of render chain
    const layoutName = ctx.state.get("layout") as string,
      layoutData = getLayoutData(layoutName);
    for (const key in layoutData) {
      // route-specific data has priority over layout data
      if (!ctx.state.has(key)) ctx.state.set(key, layoutData[key]);
    }
    return _renderHtml(ctx, render);
  };

const indexLayouts = async (manifest: Manifest) => {
  const decoder = new TextDecoder("utf-8"),
    dir = new URL("./routes/_layouts", manifest.importRoot),
    files = await walkDirectory(dir);
  for (const { content, pathname } of files) {
    const layout = { ...(manifest.layouts[pathname] ?? {}) };
    let body = decoder.decode(content as Uint8Array);
    if (hasFrontmatter(body)) {
      const { body: _body, attrs } = extractFrontmatter(body);
      Object.assign(layout, attrs);
      body = _body;
    }
    layout.name ??= pathname.slice(1);
    layout.default ??= () => body;
    layout.renderEngines ??= getRenderersByExtension(pathname);
    useLayout(layout);
  }
};

const indexRoutes = async (manifest: Manifest) => {
  const decoder = new TextDecoder("utf-8"),
    files = await walkDirectory(new URL("./routes", manifest.importRoot));

  for (const { content, pathname } of files) {
    const [, status] = pathname.match(/\/_(\d+)+\.[^/]+$/) ?? [],
      isData = /\/_data\.[^/]+$/.test(pathname),
      isMiddleware = /\/_middleware\.[^/]+$/.test(pathname),
      isErrorHandler = isErrorStatus(+status);
    if (!(isData || isMiddleware || isErrorHandler)) {
      if (manifest.ignorePattern?.test(pathname)) continue;
      if (/^\/_(layouts|components)\//.test(pathname)) continue;
    }

    const ext = extname(pathname),
      exports = { ...(manifest.routes[pathname] ?? {}) };
    let body = decoder.decode(content as Uint8Array);
    if (ext === ".json") Object.assign(exports, JSON.parse(body));
    if (ext === ".yaml") Object.assign(exports, parseYaml(body));
    if (ext === ".toml") Object.assign(exports, parseToml(body));
    if (!(exports.pattern instanceof URLPattern)) delete exports.pattern;
    exports.pattern ??= pathToPattern(pathname.slice(0, -ext.length));
    if (hasFrontmatter(body)) {
      const { body: _body, attrs } = extractFrontmatter(body);
      Object.assign(exports, attrs);
      body = _body;
    }

    if (isMiddleware) useMiddleware(exports as Middleware);
    else if (isData) useData(exports);
    else {
      const data: Data = {};
      for (const key in exports) {
        if (["default", "handler", ...HttpMethods].includes(key)) continue;
        data[key] = exports[key as keyof typeof exports];
      }
      data.renderEngines ??= getRenderersByExtension(pathname);
      if (isErrorHandler) {
        const errorHandler = exports as ErrorHandler;
        if (!manifest.routes[pathname]) errorHandler.default ??= () => body;
        errorHandler.handler ??= errorHandler.default;
        errorHandler.status = +status as ErrorStatus;
        useErrorHandler({
          ...errorHandler,
          render: (ctx: Context) => {
            for (const key in data) ctx.state.set(key, data[key]);
            return renderHtml(ctx, errorHandler.handler as _RenderFunction);
          },
        });
      } else {
        const route = exports as Route;
        if (!manifest.routes[pathname]) route.default ??= () => body;
        route.handler ??= route.default;
        if (route.GET || route.handler) {
          const GET = route.GET;
          route.GET = async (req: Request, ctx: Context) => {
            ctx.render = () => {
              return renderHtml(ctx, route.handler as _RenderFunction);
            };
            if (GET) return GET(req, ctx);
            const document = await ctx.render(),
              type = ctx.state.get("contentType") ?? "text/html",
              headers = new Headers({ "content-type": String(type) });
            return new Response(document, { status: Status.OK, headers });
          };
        }
        for (const key of HttpMethods) {
          if (!route[key]) continue;
          useMiddleware({
            method: key as HttpMethod,
            pattern: route.pattern,
            handler: route[key] as Handler,
            initialisesResponse: true,
          });
        }
        useData(data);
      }
    }
  }
};

const indexStatic = async (manifest: Manifest) => {
  const files = await walkDirectory(new URL("./static", manifest.importRoot));
  await Promise.all(files.map(async (file) => {
    const processors = getProcessors(file.pathname);
    for (const transform of processors) file = await transform(file);
    if (manifest.ignorePattern?.test(file.pathname)) return;

    useMiddleware({
      method: "GET",
      pattern: pathToPattern(file.pathname),
      handler: (req, ctx) => {
        const cacheKey = `${INTERNAL_PREFIX}_cache_id`,
          cacheId = ctx.url.searchParams.get(cacheKey),
          cacheControl = "public, max-age=31536000, immutable",
          headers = new Headers({
            "content-type": file.type,
            "vary": "If-None-Match",
            etag: file.etag,
          });
        if (cacheId && cacheId !== BUILD_ID) {
          // redirect files cached from old builds to uncached path
          ctx.url.searchParams.delete(cacheKey);
          return Response.redirect(ctx.url);
          // cache requested files matching current build for a year
        } else if (cacheId) headers.set("cache-control", cacheControl);
        // conditional request: only send response body if cache resource has
        // changed, tested by comparing etags (hashed from build id and pathname)
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-None-Match
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/304
        const etagsMatch = (a: string, b: string) =>
          a?.replace(/^W\//, "") === b?.replace(/^W\//, "");
        return etagsMatch(file.etag, req.headers.get("if-none-match") ?? "")
          ? new Response(null, { status: Status.NotModified, headers })
          : new Response(file.content, { status: Status.OK, headers });
      },
      initialisesResponse: true,
    });
  }));
};

export { indexLayouts, indexRoutes, indexStatic };
