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
    | Route<unknown>
    | ErrorPage<unknown>
  >;
  // import.meta.url of manifest file (in project root)
  baseUrl: string;
}

type Promisable<T> = T | Promise<T>;
type State = Map<string, unknown>;
type Handler = (
  req: Request,
  ctx: Context,
) => Promisable<Response>;
interface Context extends ConnInfo {
  url: URL;
  state: State;
  params: Record<string, string | string[]>;
  next?: () => ReturnType<Handler>;
  render?: () => Promisable<string>;
}

type Route<T> =
  & { [k in HttpMethod]?: Handler }
  & {
    pattern?: URLPattern;
    isMiddleware?: false;
    renderEngine?: Plugin<T>;
    default?: (ctx: Context) => T;
  };
interface Middleware {
  default: Handler;
  isMiddleware?: true;
}
interface ErrorPage<T> {
  renderEngine?: Plugin<T>;
  default?: (ctx: Context) => T;
}

interface Plugin<T> {
  // executed once on server start
  routeRegistrar?: (manifest: Manifest) => Route<T>[];
  // processors and renderers are each executed once per route render
  // multiple plugins can register processors

  // pre-parses route data,
  // e.g. to build a table-of-contents and store it in the render state
  preRenderProcessor?: (data: T, state?: State) => Promisable<T>;
  // executed once per render to transform route data,
  // only one plugin's render function is executed per route
  // e.g. to render jsx to a string
  routeRenderer?: (data: T, state?: State) => Promisable<string>;
  // executed once per render to post-parse a rendered route,
  // multiple plugins can execute this on the same route
  // e.g. to collect classnames and store generated styles in the render state
  postRenderProcessor?: (route: string, state?: T) => Promisable<string>;
  // executed once per render
  templateRenderer?: (route: string, state?: T) => Promisable<Response>;
  // executed once per file in the static/ directory
  staticFileProcessor?: (file: StaticFile) => Promisable<StaticFile>;
  middleware?: {
    pattern?: URLPattern;
    handler: Handler;
  }[];
}

interface StaticFile {
  filePath: URL;
  servePath: string;
  sizeInBytes: number;
  contentType: string;
  // hash of the file's contents
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag
  entityTag: string;
  // file will be served from memory instead of from the filesystem
  // if this is set. useful for e.g. serving minified assets
  // note: consider performance tradeoffs (e.g. reading & transpilation vs. taken up memory)
  cachedContent?: string | Blob | BufferSource | ReadableStream<Uint8Array>;
}

export {
  type Context,
  type ErrorPage,
  type Handler,
  type HttpMethod,
  type Manifest,
  type Middleware,
  type Plugin,
  type Route,
  type State,
  type StaticFile,
};
