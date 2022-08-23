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
  file: RouteFile;
  next?: () => Promisable<T>;
  render?: () => Promisable<string>;
}

type Route =
  & { [k in HttpMethod]?: Handler }
  & {
    [k: string]: unknown;
    pattern?: URLPattern;
    default?: <T>(ctx: Context) => T;
  };
type Middleware =
  & { pattern?: URLPattern }
  & ({ default: Handler } | { handler: Handler });

// deno-lint-ignore no-explicit-any
interface Plugin<T = any> {
  /**
   * specifies which routes the plugin can preprocess/render.
   * plugins are sorted from highest to lowest specificity
   * (e.g. `.tmpl.ts` > `.ts`) to determine the order route
   * preprocessors should be called in and which renderer should
   * be used for a route. `*` handles all extensions but has the
   * lowest specificity
   */
  targetFileExtensions?: ("*" | string)[];
  /**
   * called on targeted routes pre-render
   */
  routePreprocessor?: (body: T, ctx: Context) => Promisable<T>;
  /**
   * called on targeted routes to transform route data. if the route is a
   * `.ts`/`.js`/`.tsx`/`.jsx` file, the renderer is passed the return value
   * of the route's default export with the named exports set to `ctx.state`
   * (excluding route handlers). if the route is any other file type, the
   * renderer is passed the file's contents as a string with any frontmatter
   * extracted and set to `ctx.state`. this must return a string of html
   */
  routeRenderer?: (body: T, ctx: Context) => Promisable<string>;
  /**
   * called on every served route post-render. if multiple available
   * postprocessors exist they are called in order of plugin registration
   */
  routePostprocessor?: (body: string, ctx: Context) => Promisable<string>;
  /**
   * called once per file in the static/ directory on server startup
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
   * caches raw file contents to reduce repetitive file reads,
   * without decoding file contents in case e.g. file is an image
   */
  raw: Uint8Array;
}
interface RouteFile extends File {
  /**
   * caches decoded file contents for processing frontmatter
   * and then passing to route renderers
   */
  content: string;
  /**
   * the file's path relative to the routes/ directory,
   * used internally for matching routes to their exports
   */
  pathname: string;
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
  type File,
  type Handler,
  type HttpMethod,
  type Manifest,
  type Middleware,
  type Plugin,
  type Route,
  type RouteFile,
  type StaticFile,
};
