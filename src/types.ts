import { type ConnInfo } from "https://deno.land/std@0.150.0/http/mod.ts";

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
  routes: Record<
    string,
    | Middleware
    | Route
    | ErrorPage<unknown>
  >;
  // import.meta.url of manifest file (in project root)
  baseUrl: string;
}

type Promisable<T> = T | Promise<T>;
type State = Map<string, unknown>;
type Params = Record<string, string | string[]>;
type Handler = (
  req: Request,
  ctx: Context<Response> & ConnInfo,
) => Promisable<Response>;
interface Context<T = undefined> {
  url: URL;
  state: State;
  params: Params;
  file: File;
  next?: () => Promisable<T>;
  render?: () => Promisable<string>;
}

type Route =
  & { [k in HttpMethod]?: Handler }
  & { pattern?: URLPattern; default?: <T>(ctx: Context) => T };
type Middleware =
  & { pattern?: URLPattern }
  & ({ default: Handler } | { handler: Handler });
interface ErrorPage<T> {
  renderEngine?: Plugin<T>;
  default?: (ctx: Context<Response>) => T;
}

interface Plugin<T = unknown> {
  /**
   * specifies which routes the plugin can preprocess/render.
   * if multiple available renderers exist, the one with the
   * most specific extension is selected (e.g. `.tmpl.ts` > `.ts`).
   * `*` handles all extensions but has the lowest specificity
   */
  targetFileExtensions?: ("*" | string)[];
  /**
   * if the route is a `.ts`/`.js`/`.tsx`/`.jsx` file, the file's named exports
   * (excluding http handlers and route pattern) are set to `ctx.state`.
   * if the route is any other file type, the file's frontmatter is extracted
   * from the file's contents and set to `ctx.state`.
   * [default: true]
   */
  processFileFrontmatter?: boolean;
  /**
   * called on targeted routes to transform route data. if the route is a
   * `.ts`/`.js`/`.tsx`/`.jsx` file, the renderer is passed the return value
   * of the route's default export. if the route is any other file type, the
   * renderer is passed the file's contents as a string. this must return
   * a string of html
   */
  routeRenderer?: (data: T, ctx: Context) => Promisable<string>;
  /**
   * called on every served route post-render, if multiple available
   * postprocessors exist they are called in order of plugin registration
   */
  routePostprocessor?: (
    data: string,
    ctx: Context,
  ) => Promisable<string>;
  /**
   * called once per file in the static/ directory
   * during server startup and file indexing
   */
  staticFileProcessor?: (file: StaticFile) => Promisable<StaticFile>;
  /**
   * general middleware that can be programmatically registered
   * instead of creating a _middleware.ts route (e.g. for auth)
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
   * used to serve files from memory instead of from the filesystem,
   * to reduce file reads (also useful for e.g. serving minified assets)
   */
  content?: string | Blob | BufferSource | ReadableStream<Uint8Array>;
}
interface StaticFile extends File {
  /**
   * the file's path relative to the static/ directory,
   * used as the file's public path when served
   */
  pathname: string;
}

export {
  type Context,
  type ErrorPage,
  type File,
  type Handler,
  type HttpMethod,
  type Manifest,
  type Middleware,
  type Plugin,
  type Route,
  type StaticFile,
};
