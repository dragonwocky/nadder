import { type ConnInfo } from "std/http/mod.ts";

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
type Handler = (
  req: Request,
  ctx: HandlerContext,
) => Promisable<Response>;
interface HandlerContext extends ConnInfo {
  url: URL;
  state: Map<string, unknown>;
  params: Record<string, string | string[]>;
  next?: () => ReturnType<Handler>;
  render?: () => Promisable<string>;
}

type Route =
  & { [k in HttpMethod]?: Handler }
  & { pattern?: URLPattern; default?: <T>(ctx: HandlerContext) => T };
type Middleware =
  & { isMiddleware?: true }
  & ({ default: Handler } | { handler: Handler });
interface ErrorPage<T> {
  renderEngine?: Plugin<T>;
  default?: (ctx: HandlerContext) => T;
}

type PluginContext =
  & Pick<HandlerContext, "url" | "state" | "params">
  & File;
interface Plugin<T> {
  /**
   * specifies which routes the plugin can preprocess/render.
   * plugin priority will be decided based on length of the ext
   * e.g. a plugin registered to handle `.tmpl.ts` would be
   * called before `.ts` (`*` handles all extensions)
   */
  targetFileExtensions?: string[];
  /**
   * called on targeted routes to pre-parse data, if multiple available
   * preprocessors exist they are called in order of plugin priority
   * (e.g. to take out frontmatter and store it in ctx.state)
   */
  routePreprocessor?: (data: T, ctx: PluginContext) => Promisable<T>;
  /**
   * called on targeted routes to transform route data. if multiple
   * available renderers exist, the one with the highest priority is selected.
   * this must return a html string, and may accept any input. if the route
   * is a .ts/.js/.tsx/.jsx file, the return value of the route's default
   * export will be passed to the renderer. if the route is any other file type,
   * the contents of the file will be passed as a string
   */
  routeRenderer?: (data: T, ctx: PluginContext) => Promisable<string>;
  /**
   * called on every served route post-render, if multiple available
   * postprocessors exist they are called in order of plugin priority
   */
  routePostprocessor?: (data: string, ctx: PluginContext) => Promisable<string>;
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
   * the size of the file in bytes,
   * used in generating http headers
   */
  sizeInBytes: number;
  /**
   * a file url with the file's absolute path,
   * used to read the file from the local filesystem
   */
  absolutePath: URL;
  /**
   * the file's path relative to the directory the file was read from,
   * used as the file's public path when served
   */
  relativePath?: string;
  /**
   * used to serve files from memory instead of from the filesystem,
   * to reduce file reads (also useful for e.g. serving minified assets)
   */
  cachedContent: string | Blob | BufferSource | ReadableStream<Uint8Array>;
}
interface StaticFile extends File {
  /**
   * a http content-type header value inc. mime type and encoding
   * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Type
   */
  contentType: string;
  /**
   * hash of the file's contents
   * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag
   */
  ETag: string;
}

export {
  type ErrorPage,
  type File,
  type Handler,
  type HandlerContext,
  type HttpMethod,
  type Manifest,
  type Middleware,
  type Plugin,
  type PluginContext,
  type Route,
  type StaticFile,
};
