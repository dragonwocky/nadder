import { BUILD_ID, INTERNAL_PREFIX } from "../constants.ts";
import {
  type ErrorStatus,
  extname,
  extractFrontmatter,
  hasFrontmatter,
  isErrorStatus,
  parseToml,
  parseYaml,
  Status,
} from "./deps.ts";
import {
  getRenderersByExtension,
  getTransformers,
  useData,
  useErrorHandler,
  useMiddleware,
} from "./hooks.ts";
import { createResponse, pathToPattern, walkDirectory } from "./utils.ts";
import { renderPage } from "./renderer.ts";
import {
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

type _Template = {
  name?: string;
  // deno-lint-ignore no-explicit-any
  render?: any;
  renderEngines?: string[];
  default?: _Template["render"];
};
const indexTemplates = async <T extends _Template>(
  manifest: Manifest,
  type: Exclude<
    {
      [K in keyof Manifest]: Manifest[K] extends Record<string, T> ? K
        : never;
    }[keyof Manifest],
    undefined
  >,
  hook: (tmpl: T) => void,
) => {
  const decoder = new TextDecoder("utf-8"),
    dir = new URL(`./routes/_${type}`, manifest.importRoot),
    files = await walkDirectory(dir);
  for (const { content, pathname } of files) {
    if (manifest.ignorePattern?.test(pathname)) continue;

    const tmpl = { ...(manifest[type][pathname] ?? {}) } as T;
    let body = decoder.decode(content as Uint8Array);
    if (hasFrontmatter(body)) {
      const { body: _body, attrs } = extractFrontmatter(body);
      Object.assign(tmpl, attrs);
      body = _body;
    }
    tmpl.name ??= pathname.slice(1);
    tmpl.render ??= tmpl.default ?? (() => body);
    tmpl.renderEngines ??= getRenderersByExtension(pathname);
    hook(tmpl);
  }
};

const indexRoutes = async (manifest: Manifest) => {
  const decoder = new TextDecoder("utf-8"),
    files = await walkDirectory(new URL("./routes", manifest.importRoot));

  for (const { content, pathname } of files) {
    const [, status] = pathname.match(/\/_(\d\d\d)\.[^/]+$/) ?? [],
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
      if (!manifest.routes[pathname]) exports.default ??= () => body;
      if (isErrorHandler) {
        const errorHandler = exports as ErrorHandler;
        errorHandler.render ??= errorHandler.default;
        errorHandler.status = +status as ErrorStatus;
        useErrorHandler({
          ...errorHandler,
          render: (ctx: Context) => {
            for (const key in data) ctx.state.set(key, data[key]);
            return renderPage(ctx, errorHandler.render!);
          },
        });
      } else {
        const route = exports as Route;
        route.render ??= route.default;
        if (route.GET || route.render) {
          const { GET } = route;
          route.GET = async (req: Request, ctx: Context) => {
            ctx.render = () => renderPage(ctx, route.render!);
            if (GET) return GET(req, ctx);
            const document = await ctx.render(),
              type = ctx.state.get("contentType") ?? "text/html";
            return createResponse(document, { "content-type": String(type) });
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
    const transformers = getTransformers(file.pathname);
    for (const transform of transformers) file = await transform(file);
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
        // set last modified if known
        if (file.mtime) headers.set("last-modified", file.mtime.toUTCString());
        // conditional request: only send response body if cache resource has
        // changed, tested by comparing etags (hashed from build id and pathname)
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-None-Match
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/304
        const etagsMatch = (a: string, b: string) =>
          a?.replace(/^W\//, "") === b?.replace(/^W\//, "");
        return etagsMatch(file.etag, req.headers.get("if-none-match") ?? "")
          ? createResponse(null, { status: Status.NotModified, headers })
          : createResponse(file.content, { status: Status.OK, headers });
      },
      initialisesResponse: true,
    });
  }));
};

export { indexRoutes, indexStatic, indexTemplates };
