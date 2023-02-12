import type { ConnInfo } from "std/http/mod.ts";
import type { ErrorStatus } from "std/http/http_status.ts";

const HttpMethods = [
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
] as const;
type HttpMethod = typeof HttpMethods[number];

interface Manifest {
  /**
   * the exported handlers and data from within the /routes
   * directory, generated to avoid dependence on dynamic imports
   */
  routes: Record<
    string,
    | Data
    | Route
    | Middleware
    | ErrorHandler
  >;
  /**
   * the project root to serve from, defaulting to the result of
   * `new URL("./", import.meta.url)` of the manifest.gen.ts
   */
  baseUrl: URL;
  /**
   * a pattern tested against file paths loaded from the /routes
   * and /static directories to filter out certain files & folders
   * [default: \/(\.|_)]
   */
  ignorePattern?: RegExp;
}

type Promisable<T> = T | Promise<T>;
type Renderer<T> = (ctx: Context) => Promisable<T>;
type Handler = (
  req: Request,
  ctx: Context,
) => Promisable<Response>;
type Context = {
  url: URL;
  params: Record<string, string | string[]>;
  /**
   * used to persist data across middleware handlers, has
   * the non-handler exports and/or frontmatter of a route
   * set to it by default. keys defined in _data.* files
   * will be set to the `ctx.state` of all adjacent or
   * nested routes
   */
  state: Map<string, unknown>;
  /**
   * the matched file from the /static directory,
   * unless responding from a registered route
   */
  file?: File;
  /**
   * only available to middleware handlers,
   * for e.g. adding headers to a response
   */
  next?: () => ReturnType<Handler>;
  /**
   * only available to middleware handlers when
   * responding from a registered route, returns
   * the route rendered to a string of html
   */
  render?: () => ReturnType<RenderEngine["render"]>;
} & ConnInfo;

type Data = {
  pattern?: URLPattern;
  /**
   * data set in _data.* files is applied to the
   * `ctx.state` of all adjacent or nested routes
   */
  [k: string]: unknown;
};
type Route =
  & ({ default?: Renderer<unknown> } | { handler?: Renderer<unknown> })
  & {
    pattern?: URLPattern;
    /**
     * data to apply to `ctx.state` on route render
     */
    [k: string]: unknown;
  }
  /**
   * middleware handlers that will act only on this
   * route (e.g. for prefetching data to store in state)
   */
  & { [k in HttpMethod]?: Handler };
type Middleware =
  & {
    pattern?: URLPattern;
    method?: HttpMethod;
    /**
     * used to differentiate between pre/postprocessing
     * middleware handlers and route/file handlers. if
     * middleware that match the request url exist but
     * none have this flag set, a 405 method not allowed
     * response will be sent
     */
    initialisesResponse?: boolean;
  }
  /**
   * handlers defined in _middleware.* files
   * act on all adjacent or nested routes
   */
  & ({ default: Handler } | { handler: Handler });

type RenderEngine = {
  /**
   * specifies which routes/files the plugin can render/process.
   * processors are sorted from highest to lowest specificity
   * (e.g. `.tmpl.ts` > `.ts`) to determine the order plugins
   * should be called in and which renderer should be used for
   * a route. `*` matches all files but has the lowest specificity
   */
  target: string;
  /**
   * called on targeted routes to transform route data. if the route is
   * a javascript file, the renderer is passed the return value of the
   * route's default export with the named exports set to `ctx.state`.
   * if the route is any other file type, the renderer is passed the
   * file's contents as a string with any frontmatter extracted and
   * set to `ctx.state`. this must return a string of html
   */
  render: (data: unknown, ctx: Context) => Promisable<string>;
};
type ErrorHandler = Middleware & { status?: ErrorStatus };

interface File {
  /**
   * a file url with the file's absolute path,
   * used to read the file from the local filesystem
   */
  location: URL;
  /**
   * the file's path relative to the static/ directory,
   * used as the file's public path when served
   */
  pathname: string;
  /**
   * the size of the file in bytes,
   * used in generating http headers
   */
  size: number;
  /**
   * a http content-type header value inc. mime type and encoding
   * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type
   */
  type: string;
  /**
   * hash of the file's contents
   * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag
   */
  etag: string;
  /**
   * the file's contents, cached to reduce repeated file reads
   * and plugin processing of files
   */
  content:
    | Blob
    | BufferSource
    | Uint8Array
    | string;
}

export { HttpMethods };
export type {
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
};
