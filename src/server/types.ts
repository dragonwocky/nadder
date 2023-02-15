import type { ErrorStatus } from "std/http/http_status.ts";
import type { ConnInfo } from "std/http/mod.ts";

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
   * the project root to import and serve routes and static files from,
   * defaulting to the `import.meta.url` of the manifest.gen.ts file
   */
  importRoot: string;
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
  /**
   * creates a http response from any available _status.*
   * error handler pages, otherwise returns a plaintext
   * error status message
   */
  renderNotFound: () => Promisable<Response>;
  renderBadRequest: () => Promisable<Response>;
  renderUnauthorized: () => Promisable<Response>;
} & ConnInfo;

interface Data {
  pattern?: URLPattern;
  /**
   * data set in _data.* files is applied to the
   * `ctx.state` of all adjacent or nested routes
   */
  [k: string]: unknown;
}
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

interface RenderEngine {
  /**
   * engine name, used to manually select an engine or queue
   * multiple engines via the `renderEngines` key of `ctx.state`
   */
  id: string;
  /**
   * specifies which routes this engine can render.
   * renderers are sorted from highest to lowest specificity
   * (e.g. `.tmpl.ts` > `.ts`) to determine the order they
   * should be called on a route in. `*` matches all routes but
   * has the lowest specificity
   */
  targets: string[];
  /**
   * called on targeted routes each time they are requested
   * to transform route data. this must return a string of html.
   *
   * if this is the renderer with the highest priority and the
   * route is a javascript file, the renderer is passed the return
   * value of the route's default export with the named exports set
   * to `ctx.state`. if the route is any other file type, the renderer
   * is passed the file's contents as a string with any frontmatter
   * extracted and set to `ctx.state`. all consequent renderers called
   * will be passed the output of the previous renderer
   */
  render: (page: unknown, ctx: Context) => Promisable<string>;
}
interface FileProcessor {
  /**
   * specifies which files this processor can transform.
   * processors are sorted from highest to lowest specificity
   * (e.g. `.next.css` > `.css`) to determine the order they
   * should be called on a file in. `*` matches all files but
   * has the lowest specificity
   */
  targets: string[];
  /**
   * called once on targeted files on server startup to
   * preprocess file contents, types and/or pathnames
   */
  transform: (file: File) => Promisable<File>;
}
/**
 * the default http error pages can be overriden by
 * error page handlers exported from _status.* files.
 * note: in the case of a http 500 error, the error will
 * be accessible via `ctx.state.get("error")`
 */
type ErrorHandler =
  & { pattern?: URLPattern; status?: ErrorStatus; [k: string]: unknown }
  & ({ default: Handler } | { handler: Handler });

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
    | Uint8Array
    | string;
}

export { HttpMethods };
export type {
  Context,
  Data,
  ErrorHandler,
  File,
  FileProcessor,
  Handler,
  HttpMethod,
  Manifest,
  Middleware,
  RenderEngine,
  Renderer,
  Route,
};
