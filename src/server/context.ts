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
  Manifest,
  Middleware,
  Route,
  SharedData,
} from "../types.ts";
import { walkDirectory } from "./reader.ts";

import {
  extract as extractFrontmatter,
  test as hasFrontmatter,
} from "std/encoding/front_matter/any.ts";
import { parse as parseYaml } from "std/encoding/yaml.ts";
import { parse as parseToml } from "std/encoding/toml.ts";
import { isErrorStatus } from "std/http/http_status.ts";
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
};

const registerData = () => {},
  registerRoute = (route: Route) => {
  },
  registerMiddleware = (middleware: Middleware) => {
  };

const indexRoutes = async (manifest: Manifest) => {
  const decoder = new TextDecoder("utf-8"),
    files = await walkDirectory(new URL("./routes", manifest.baseUrl));

  const routes: Route[] = [],
    middleware: Middleware[] = [],
    sharedData: SharedData[] = [],
    errorHandlers: ErrorHandler[] = [];
  for (const { content, pathname } of files) {
    const [, statusCode] = pathname.match(/\/_(\d+)+\.(t|j)sx?$/) ?? [],
      isErrorHandler = isErrorStatus(+statusCode[1]),
      isSharedData = /\/_data\.(ts|js|json|yaml|toml)$/.test(pathname),
      isMiddleware = /\/_middleware\.(t|j)sx?$/.test(pathname);
    if (!(isSharedData || isMiddleware || isErrorHandler)) {
      if (manifest.ignorePattern?.test(pathname)) continue;
    }

    let exports = manifest.routes[pathname];
    const body = decoder.decode(content as Uint8Array),
      pattern = pathToPattern(pathname.slice(0, -extname(pathname).length));
    if (isSharedData) {
      if (pathname.endsWith(".json")) exports ??= JSON.parse(body);
      if (pathname.endsWith(".yaml")) exports ??= parseYaml(body);
      if (pathname.endsWith(".toml")) exports ??= parseToml(body);
      sharedData.push({ pattern, ...exports });
    } else if (isMiddleware) {
      middleware.push({ pattern, ...exports } as Middleware);
    } else if (isErrorHandler) {
      errorHandlers.push({
        status: +statusCode,
        pattern,
        ...exports,
      } as ErrorHandler);
    } else if (/\.(t|j)sx?$/.test(pathname)) {
      routes.push({ pattern, ...exports } as Route);
    } else if (hasFrontmatter(body)) {
      const { body: _body, attrs } = extractFrontmatter(body);
      routes.push({ pattern, default: () => _body, ...attrs });
    } else routes.push({ pattern, default: () => body });
  }

  return { routes, middleware, sharedData, errorHandlers };
};

const indexStatic = async () => {},
  processStatic = async () => {};

export { indexRoutes };
