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
  ErrorHandler,
  File,
  Handler,
  HttpMethod,
  Manifest,
  Middleware,
  RenderEngine,
  Route,
  SharedData,
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

const _routes: Route[] = [],
  _middleware: Middleware[] = [],
  _sharedData: SharedData[] = [],
  _renderEngines: RenderEngine[] = [];
// _errorHandlers: ErrorHandler[] = [];

const useRoute = (route: Route) => {
    _routes.push(route);
    sortByPattern<Route[]>(_routes);
  },
  useData = (sharedData: SharedData) => {
    sharedData.pattern ??= new URLPattern({ pathname: "/" });
    if (Object.keys(sharedData).length < 2) return;
    _sharedData.push(sharedData);
    sortByPattern<SharedData[]>(_sharedData);
  },
  useMiddleware = (middleware: Middleware) => {
    middleware.method ??= "*";
    _middleware.push(middleware);
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
    console.log(html);
    return new Response(html, { status: Status.OK, headers });
  },
  // createFileResponse
  composeResponse = async (req: Request, connInfo: ConnInfo) => {
    const url = new URL(req.url);
    const route = _routes.find(({ pattern }) => pattern!.exec(url)),
      data = _sharedData.filter(({ pattern }) => pattern!.exec(url)),
      middleware = _middleware.filter(({ pattern, method }) => {
        return pattern!.exec(url) && (["*", req.method].includes(method!));
      });
    if (!route) return Response.error();

    const state = new Map();
    for (const obj of data) {
      for (const key in obj) {
        if (key === "pattern") continue;
        state.set(key, obj[key]);
      }
    }

    const ctx: Context = { url, state, params: {}, ...connInfo },
      setParams = (pattern?: URLPattern) =>
        ctx.params = pattern?.exec(ctx.url)?.pathname.groups ?? {};
    ctx.render = () => {
      setParams(route.pattern);
      return route._render?.(ctx) ?? "";
    };
    ctx.next = () => {
      const mw = middleware.shift()!;
      if (!middleware.length) delete ctx.next;
      setParams(mw.pattern);
      return mw.default(req, ctx);
    };

    return (await ctx.next()) ?? Response.error();
  };

const indexRoutes = async (manifest: Manifest) => {
  const decoder = new TextDecoder("utf-8"),
    files = await walkDirectory(new URL("./routes", manifest.baseUrl));

  for (const { content, pathname } of files) {
    const [, status] = pathname.match(/\/_(\d+)+\.[^/]+$/) ?? [],
      isMiddleware = /\/_middleware\.[^/]+$/.test(pathname),
      isSharedData = /\/_data\.[^/]+$/.test(pathname),
      isErrorHandler = isErrorStatus(+status?.[1]);
    if (!(isSharedData || isMiddleware || isErrorHandler)) {
      if (manifest.ignorePattern?.test(pathname)) continue;
    }

    const ext = extname(pathname),
      exports = manifest.routes[pathname] ?? {},
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

    if (isMiddleware) {
      console.log(exports);
      useMiddleware(exports as Middleware);
    } else if (isSharedData) useData(exports);
    else if (isErrorHandler) {
      //   (exports as ErrorHandler).status = +status;
      //   registerErrorHandler(exports as ErrorHandler);
    } else {
      (exports as Route).GET ??= createRouteResponse;
      const route: Route = { pattern: exports.pattern },
        data: SharedData = {};
      for (const key in exports) {
        if (HttpMethods.includes(key as HttpMethod)) {
          useMiddleware({
            method: key as HttpMethod,
            pattern: route.pattern,
            default: (exports as Route)[key] as Handler,
          });
        } else if (key !== "default") {
          data[key] = (exports as SharedData)[key];
        }
      }
      route._render = (ctx: Context) =>
        engine((exports as Route).default?.(ctx) ?? body, ctx);
      useRoute(route);
      useData(data);
    }
  }
};

const indexStatic = async () => {},
  processStatic = async () => {};

export { composeResponse, indexRoutes, useData, useMiddleware, useRenderer };
