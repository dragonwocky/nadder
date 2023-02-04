import type { ConnInfo } from "std/http/mod.ts";

type HttpMethod =
  | "*"
  | "GET"
  | "HEAD"
  | "POST"
  | "PUT"
  | "DELETE"
  | "CONNECT"
  | "OPTIONS"
  | "TRACE"
  | "PATCH";

interface Manifest {
  /**
   * the exported handlers and data from within the /routes
   * directory, generated to avoid dependence on dynamic imports
   */
  routes: Record<
    string,
    | Middleware
    | Route
  >;
  /**
   * the import.meta.url of the manifest.gen.ts file,
   * used to determine the project root to serve from
   */
  projectRoot: string;
  /**
   * a pattern tested against file paths loaded from the /routes
   * and /static directories to filter out certain files & folders
   * [default: \/(\.|_)]
   */
  ignorePattern?: RegExp;
}

type Promisable<T> = T | Promise<T>;
type Handler = (
  req: Request,
  ctx: Context & ConnInfo,
) => Promisable<Response>;
interface Context {
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
  next?: () => Promisable<Response>;
  /**
   * only available to middleware handlers when
   * responding from a registered route, returns
   * the route rendered to a string of html
   */
  render?: () => Promisable<string>;
}

type Route =
  & {
    [k: string]: unknown;
    pattern?: URLPattern;
    default?: <T>(ctx: Context) => T;
  }
  & {
    /**
     * middleware handlers that will act only on this
     * route (e.g. for prefetching data to store in state)
     */
    [k in HttpMethod]?: Handler;
  };
type Middleware =
  /**
   * middleware handlers defined in _middleware.* files
   * that will act on all adjacent or nested routes
   */
  & { pattern?: URLPattern }
  & ({ default: Handler } | { handler: Handler });

interface Plugin<T = unknown> {
  /**
   * specifies which routes/files the plugin can render/process.
   * processors are sorted from highest to lowest specificity
   * (e.g. `.tmpl.ts` > `.ts`) to determine the order plugins
   * should be called in and which renderer should be used for
   * a route. `*` matches all files but has the lowest specificity
   */
  targetExtensions?: ("*" | string)[];
  /**
   * called on targeted routes pre-render
   */
  routePreprocessor?: (body: T, ctx: Context) => Promisable<T>;
  /**
   * called on targeted routes to transform route data. if the route is
   * a javascript file, the renderer is passed the return value of the
   * route's default export with the named exports set to `ctx.state`.
   * if the route is any other file type, the renderer is passed the
   * file's contents as a string with any frontmatter extracted and
   * set to `ctx.state`. this must return a string of html
   */
  routeRenderer?: (body: T, ctx: Context) => Promisable<string>;
  /**
   * called on every served route post-render. if multiple available
   * postprocessors exist they are called in order of plugin registration
   */
  routePostprocessor?: (body: string, ctx: Context) => Promisable<string>;
  /**
   * called on each targeted file in /static once on server startup
   */
  staticFileProcessor?: (body: Uint8Array) => Promisable<File["content"]>;
  /**
   * general middleware that can be programmatically registered
   * instead of creating a _middleware.* route (e.g. for auth)
   */
  middleware?: Middleware[];
}

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

export type {
  Context,
  File,
  Handler,
  HttpMethod,
  Manifest,
  Middleware,
  Plugin,
  Route,
};
