import type { ConnInfo } from "./deps.ts";

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
   * directory, generated to avoid a dependence on dynamic imports
   */
  routes: Record<
    string,
    | Middleware
    | Route
  >;
  /**
   * the import.meta.url of the manifest.gen.ts file,
   * used to determine the project root
   */
  baseUrl: string;
  /**
   * a pattern tested against file paths loaded from the /routes
   * and /static directories to filter out certain files & folders
   * [default: \/(\.|_)]
   */
  ignorePattern?: RegExp;
}

type Promisable<T> = T | Promise<T>;
type State = Map<string, unknown>;
type Params = Record<string, string | string[]>;
type Handler = (
  req: Request,
  ctx: Context & ConnInfo,
) => Promisable<Response>;
interface Context {
  url: URL;
  state: State;
  params: Params;
  file: StaticFile | RouteFile;
  /**
   * only available to middleware handlers,
   * for e.g. adding headers to a response
   */
  next?: () => Promisable<Response>;
  /**
   * only available to middleware handlers,
   * will return the route rendered to html
   * (if it exists)
   */
  render?: () => Promisable<string>;
}

type Route =
  & {
    /**
     * middleware handlers that will act only
     * on this route, useful for e.g. prefetching
     * data before route render
     */
    [k in HttpMethod]?: Handler;
  }
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

type Frontmatter = Record<string, unknown>;
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
   * caches decoded file contents for passing to route
   * renderers with the frontmatter pre-extracted out
   */
  content: string;
  /**
   * the route's frontmatter if it is not a
   * `.ts`/`.js`/`.tsx`/`.jsx` file
   */
  frontmatter?: Frontmatter;
  /**
   * the route's exports if it is a
   * `.ts`/`.js`/`.tsx`/`.jsx` file
   */
  exports?: Route;
}
interface StaticFile extends File {
  /**
   * the file's path relative to the static/ directory,
   * used as the file's public path when served
   */
  pathname: string;
}

export type {
  Context,
  File,
  Frontmatter,
  Handler,
  HttpMethod,
  Manifest,
  Middleware,
  Plugin,
  Route,
  RouteFile,
  StaticFile,
};
