// import {
//   compareEtag,
//   contentType,
//   dirname,
//   extractFrontmatter,
//   hasFrontmatter,
//   Status,
// } from "./deps.ts";
// import { createNotFoundResponse } from "./errors.ts";

import type {
  Context,
  Data,
  ErrorHandler,
  File,
  Handler,
  HttpMethod,
  Manifest,
  Middleware,
  RenderEngine,
  Renderer,
  Route,
} from "../types.ts";
import { HttpMethods } from "../types.ts";
import { contentType, walkDirectory } from "./reader.ts";

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
  STATUS_TEXT,
} from "std/http/http_status.ts";
import type { ConnInfo } from "std/http/mod.ts";
import { extname } from "std/path/mod.ts";

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
  sortByPattern = <T extends { pattern?: URLPattern }[]>(handlers: T) => {
    // sort by specifity: outer scope executes first
    // e.g. /admin/signin -> routes/_middleware
    // ctx.next() -> routes/admin/_middleware
    // ctx.next() -> routes/admin/signin
    const getPriority = (part: string) =>
      part.startsWith(":") ? part.endsWith("*") ? 0 : 1 : 2;
    return handlers.sort((a, b) => {
      const partsA = a.pattern?.pathname.split("/") ?? [],
        partsB = b.pattern?.pathname.split("/") ?? [];
      for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        if (partsA[i] === partsB[i]) continue;
        if (partsA[i] === undefined) return -1;
        if (partsB[i] === undefined) return 1;
        return getPriority(partsA[i]) - getPriority(partsB[i]);
      }
      return 0;
    });
  };

const _data: Data[] = [],
  _routes: Route[] = [],
  _middleware: Middleware[] = [],
  _renderEngines: RenderEngine[] = [];
// _errorHandlers: ErrorHandler[] = [];

const useData = (data: Data) => {
    data.pattern ??= new URLPattern({ pathname: "/*?" });
    if (Object.keys(data).length < 2) return;
    _data.push(data);
    sortByPattern<Data[]>(_data);
  },
  useRoute = (route: Route) => {
    if (!("_render" in route)) return;
    _routes.push(route);
    sortByPattern<Route[]>(_routes);
  },
  useMiddleware = (middleware: Middleware) => {
    if (!("default" in middleware || "handler" in middleware)) return;
    _middleware.push({
      method: "*",
      pattern: new URLPattern({ pathname: "/*?" }),
      ...middleware,
    });
    sortByPattern<Middleware[]>(_middleware);
  },
  useRenderer = (
    target: RenderEngine["target"],
    render: RenderEngine["render"],
  ) => {
    _renderEngines.push({ target, render });
    _renderEngines.sort((a, b) => a.target.localeCompare(b.target));
  };
// registerErrorHandler = (errorHandler: ErrorHandler) => {
//   // innermost error handler takes priority
//   sortByPattern<ErrorHandler[]>([errorHandler, ..._errorHandlers]).reverse();
// };

// const getErrorHandler = (errorCode: ErrorStatus, req: Request) => {
//   const url = new URL(req.url);
//   return _errorHandlers.find(({ status, pattern }) => {
//     return status === errorCode && pattern!.exec(url);
//   });
// };

const createRouteResponse: Handler = async (_, ctx) => {
    const html = await ctx.render!() ?? "",
      headers = new Headers({ "content-type": "text/html" });
    return new Response(html, { status: Status.OK, headers });
  },
  // createFileResponse
  composeResponse = async (req: Request, connInfo: ConnInfo) => {
    const url = new URL(req.url),
      route = _routes.find(({ pattern }) => pattern!.exec(url)),
      data = _data.filter(({ pattern }) => pattern!.exec(url)),
      patternMatched = _middleware.filter(({ pattern }) => pattern!.exec(url)),
      methodMatched = patternMatched.filter((
        { method, hasres },
      ) => hasres && (["*", req.method].includes(method!)));
    if (!route || !patternMatched.length) {
      return new Response("404 Not Found", {
        status: Status.NotFound,
        statusText: STATUS_TEXT[Status.NotFound],
      });
    }
    if (!methodMatched.length) {
      return new Response(`405 ${STATUS_TEXT[Status.MethodNotAllowed]}`, {
        status: Status.MethodNotAllowed,
        statusText: STATUS_TEXT[Status.MethodNotAllowed],
      });
    }

    const ctx: Context = { url, state: new Map(), params: {}, ...connInfo };
    for (const obj of data) {
      for (const key in obj) {
        if (key === "pattern") continue;
        ctx.state.set(key, obj[key]);
      }
    }
    ctx.next = () => {
      const mw = methodMatched.shift()!,
        params = mw.pattern?.exec(ctx.url)?.pathname.groups ?? {},
        handler = "handler" in mw ? mw.handler : mw.default;
      if (!methodMatched.length) delete ctx.next;
      return handler(req, { ...ctx, params });
    };

    return (await ctx.next()) ?? Response.json({ error: "zilch" });
  };

const indexRoutes = async (manifest: Manifest) => {
  const decoder = new TextDecoder("utf-8"),
    files = await walkDirectory(new URL("./routes", manifest.baseUrl));

  for (const { content, pathname } of files) {
    const [, status] = pathname.match(/\/_(\d+)+\.[^/]+$/) ?? [],
      isData = /\/_data\.[^/]+$/.test(pathname),
      isMiddleware = /\/_middleware\.[^/]+$/.test(pathname),
      isErrorHandler = isErrorStatus(+status?.[1]);
    if (!(isData || isMiddleware || isErrorHandler)) {
      if (manifest.ignorePattern?.test(pathname)) continue;
    }

    const ext = extname(pathname),
      exports = { ...(manifest.routes[pathname] ?? {}) },
      engine: RenderEngine["render"] = _renderEngines.find(({ target }) => {
        return ext === target;
      })?.render ?? ((data) => String(data));
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
    else if (isErrorHandler) {
      //   (exports as ErrorHandler).status = +status;
      //   registerErrorHandler(exports as ErrorHandler);
    } else {
      const { GET, ...route } = exports as Route, data: Data = {};
      let render: Renderer<unknown> = () => body;
      if ("default" in route) render = route.default as Renderer<unknown>;
      if ("handler" in route) render = route.handler as Renderer<unknown>;
      if (
        [route.default, route.handler].includes(render) || GET ||
        !manifest.routes[pathname]
      ) {
        route.GET = (req: Request, ctx: Context) => {
          ctx = { ...ctx, render: () => route._render?.(ctx) ?? "" };
          return (GET ?? createRouteResponse)(req, ctx);
        };
      }
      route._render ??= (ctx: Context) => engine(render(ctx), ctx);
      for (const key in route) {
        if (["default", "handler", "_render"].includes(key)) continue;
        if (HttpMethods.includes(key as HttpMethod)) {
          useMiddleware({
            method: key as HttpMethod,
            pattern: route.pattern,
            handler: route[key] as Handler,
            hasres: true,
          });
        } else data[key] = route[key];
      }
      useRoute(route);
      useData(data);
    }
  }
};

const indexStatic = async () => {},
  processStatic = async () => {};

export { composeResponse, indexRoutes, useData, useMiddleware, useRenderer };
