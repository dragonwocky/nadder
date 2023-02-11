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
import { parse as parseYaml } from "std/encoding/yaml.ts";
import { parse as parseToml } from "std/encoding/toml.ts";
import {
  type ErrorStatus,
  isErrorStatus,
  Status,
} from "std/http/http_status.ts";
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
    _sharedData.push(sharedData);
    sortByPattern<SharedData[]>(_sharedData);
  },
  useMiddleware = (middleware: Middleware) => {
    middleware.method ??= "GET";
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

const composeResponse = (req: Request) => {
    const url = new URL(req.url),
      route = _routes.find(({ pattern }) => pattern!.exec(url)),
      data = _sharedData.filter(({ pattern }) => pattern!.exec(url)),
      middleware = _middleware.filter(({ pattern, method }) => {
        return pattern!.exec(url) && (["*", req.method].includes(method!));
      });
    //
  },
  createRouteResponse: Handler = async (_, ctx) => {
    const html = await ctx.render!(),
      headers = new Headers({ "content-type": "text/html" });
    // if (!html) return createNotFoundResponse(ctx);
    return new Response(html, { status: Status.OK, headers });
  };

const indexRoutes = async (manifest: Manifest) => {
  const decoder = new TextDecoder("utf-8"),
    files = await walkDirectory(new URL("./routes", manifest.baseUrl));

  for (const { content, pathname } of files) {
    const [, status] = pathname.match(/\/_(\d+)+\.[^/]+$/) ?? [],
      isMiddleware = /\/_middleware\.[^/]+$/.test(pathname),
      isSharedData = /\/_data\.[^/]+$/.test(pathname),
      isErrorHandler = isErrorStatus(+status[1]);
    if (!(isSharedData || isMiddleware || isErrorHandler)) {
      if (manifest.ignorePattern?.test(pathname)) continue;
    }

    const ext = extname(pathname),
      exports = manifest.routes[pathname] ?? {},
      engine: RenderEngine["render"] = _renderEngines.find(({ target }) => {
        return ext === target;
      })?.render ?? ((_, data) => String(data));
    let body = decoder.decode(content as Uint8Array);
    if (ext === ".json") Object.assign(exports, JSON.parse(body));
    if (ext === ".yaml") Object.assign(exports, parseYaml(body));
    if (ext === ".toml") Object.assign(exports, parseToml(body));
    exports.pattern ??= pathToPattern(pathname.slice(0, -ext.length));
    if (hasFrontmatter(body)) {
      const { body: _body, attrs } = extractFrontmatter(body);
      Object.assign(exports, attrs);
      body = _body;
    }

    if (isMiddleware) useMiddleware(exports as Middleware);
    else if (isSharedData) useData(exports);
    else if (isErrorHandler) {
      //   (exports as ErrorHandler).status = +status;
      //   registerErrorHandler(exports as ErrorHandler);
    } else {
      const route: Route = { GET: createRouteResponse },
        data: SharedData = {};
      for (const key in exports) {
        if ([...HttpMethods, "default"].includes(key)) {
          route[key] = (exports as Route)[key];
        } else data[key] = (exports as SharedData)[key];
      }
      route._render = (ctx: Context) =>
        engine(route.default?.(ctx) ?? body, ctx);
      useRoute(route);
      useData(data);
    }
  }
};

const indexStatic = async () => {},
  processStatic = async () => {};

export { indexRoutes, useData, useMiddleware, useRenderer };
