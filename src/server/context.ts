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
  _middleware: Middleware[] = [],
  _renderEngines: RenderEngine[] = [];
// _errorHandlers: ErrorHandler[] = [];

const useData = (data: Data) => {
    data.pattern ??= new URLPattern({ pathname: "/*?" });
    if (Object.keys(data).length < 2) return;
    _data.push(data);
    sortByPattern<Data[]>(_data);
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

const getData = (url: URL) => {
    return _data.filter(({ pattern }) => pattern!.exec(url));
  },
  getMiddleware = (url: URL) => {
    return _middleware.filter(({ pattern }) => pattern!.exec(url));
  };

const errorResponse = (status: ErrorStatus) => {
    return new Response(`${status} ${STATUS_TEXT[status]}`, {
      status,
      statusText: STATUS_TEXT[status],
    });
  },
  composeResponse = (req: Request, connInfo: ConnInfo) => {
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

    middleware = getMiddleware(ctx.url);
    const notFound = !middleware.some((mw) => mw.initialisesResponse);
    if (!notFound) return errorResponse(Status.NotFound);
    middleware = middleware.filter((mw) => {
      return ["*", req.method].includes(mw.method!);
    });
    const mismatchedMethod = !middleware.some((mw) => mw.initialisesResponse);
    if (!mismatchedMethod) return errorResponse(Status.MethodNotAllowed);

    const data = getData(ctx.url);
    for (const obj of data) for (const key in obj) ctx.state.set(key, obj[key]);
    return ctx.next!();
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
      })?.render ?? ((data) => String(data ?? ""));
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
      const data: Data = {},
        { GET, ...route } = exports as Route,
        isPage = GET || "default" in route || "handler" in route;
      let render: Renderer<unknown> = () => body;
      if ("default" in route) render = route.default as Renderer<unknown>;
      if ("handler" in route) render = route.handler as Renderer<unknown>;
      if (isPage || !manifest.routes[pathname]) {
        route.GET = async (req: Request, ctx: Context) => {
          const _render = async () => engine(await render(ctx), ctx);
          if (GET) return GET(req, { ...ctx, render: _render });
          const document = await _render(),
            type = ctx.state.get("contentType") ?? "text/html",
            headers = new Headers({ "content-type": String(type) });
          return new Response(document, { status: Status.OK, headers });
        };
      }
      for (const key in route) {
        if (["default", "handler"].includes(key)) continue;
        if (HttpMethods.includes(key as HttpMethod)) {
          useMiddleware({
            method: key as HttpMethod,
            pattern: route.pattern,
            handler: route[key] as Handler,
            initialisesResponse: true,
          });
        } else data[key] = route[key];
      }
      useData(data);
    }
  }
};

const indexStatic = async () => {},
  processStatic = async () => {};

export { composeResponse, indexRoutes, useData, useMiddleware, useRenderer };
