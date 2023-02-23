import type { ErrorStatus } from "std/http/http_status.ts";
import type { ConnInfo } from "std/http/mod.ts";

type Promisable<T> = T | Promise<T>;

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

/**
 * the manifest describes which routes should be registed
 * and references exported handlers and data from them to
 * avoid dependenc on dynamic imports. a `manifest.gen.ts`
 * file is created based on an automatic index of the /routes
 * directory when running nadder from `dev.ts`
 */
interface Manifest {
  routes: Record<string, Data | Route | Middleware | ErrorHandler>;
  layouts: Record<string, Layout>;
  components: Record<string, Component>;
  /**
   * the project root to import and serve routes and static
   * files from, defaulting to the `import.meta.url` of
   * the manifest.gen.ts file
   */
  importRoot: string;
  /**
   * a pattern tested against file paths loaded from the /routes
   * and /static directories to filter out certain files & folders
   * [default: \/(\.|_)]
   */
  ignorePattern?: RegExp;
}

type Handler = (
  req: Request,
  ctx: Context,
) => Promisable<Response>;
type Context = {
  url: URL;
  params: Record<string, string | string[]>;
  /**
   * used to persist data across middleware handlers, has
   * non-handler exports and/or frontmatter of routes and
   * their layouts set to it by default. keys defined in
   * _data.* files will be set to the `ctx.state` of all
   * adjacent or nested routes
   */
  state:
    & Map<`_comp_${string}`, Promise<string>>
    & Map<"layout", string | undefined>
    & Map<"renderEngines", string[] | undefined>
    & Map<"contentType", string | undefined>
    & Map<"error", Error>
    & Map<string, unknown>;
  /**
   * only available to middleware, must be called to trigger the
   * next middleware handler. handlers are executed outside-in, with
   * the innermost handler responsible for returning the response
   * i.e. /_middleware -> /about/_middleware -> /about/terms
   */
  next?: () => Promisable<Response>;
  /**
   * only available to middleware handlers when
   * responding from a registered route, returns
   * the route rendered to a string of html
   */
  render?: () => Promisable<string>;
  /**
   * creates a http response from any available _status.*
   * error handler pages, otherwise returns a plaintext
   * error status message
   */
  renderNotFound: () => Promisable<Response>;
  renderBadRequest: () => Promisable<Response>;
  renderUnauthorized: () => Promisable<Response>;
} & ConnInfo;

interface File {
  /**
   * a file url with the file's absolute path,
   * used to read the file from the local filesystem
   */
  location: URL;
  /**
   * the file's path relative to the specified directory,
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
   * hash of the file's path combined with the build id
   * https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag
   */
  etag: string;
  /**
   * the file's contents, cached to avoid repeated
   * file reads and processor transform calls
   */
  content:
    | Uint8Array
    | string;
}

type _RenderFunc<P> = (
  props: P,
  components: Record<string, _ResolvableComponent>,
  filters: Record<string, Filter>,
) => Promisable<unknown>;
interface Data {
  /**
   * data set in _data.* files is applied to the
   * `ctx.state` of all adjacent or nested routes
   */
  [k: string]: unknown;
  /**
   * the pattern key is used to determine which routes to make
   * this data available to. it will be overriden if set in a
   * _data.* file but can be set to restrict data to certain
   * routes when manually registering via `useData()`
   */
  pattern?: URLPattern;
}
type Route =
  & {
    /**
     * data to apply to `ctx.state` on route render
     */
    [k: string]: unknown;
    pattern?: URLPattern;
    layout?: string;
    /**
     * each route should export a page to be renderered via
     * the matching render engine, either detected from the
     * route's file extension or as specified by the
     * `renderEngines` key of `ctx.state`
     */
    render?: _RenderFunc<Context>;
    renderEngines?: string[];
    default?: Route["render"];
  }
  /**
   * middleware handlers that will act only on this
   * route (e.g. for prefetching data to store in state)
   */
  & { [k in HttpMethod]?: Handler };
interface Middleware {
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
  /**
   * handlers defined in _middleware.* files
   * act on all adjacent or nested routes
   */
  handler?: Handler;
  default?: Middleware["handler"];
}
interface ErrorHandler {
  /**
   * data to apply to `ctx.state` on error render.
   * note: in the case of a http 500 error, the error
   * will be accessible via the `error` key of `ctx.state`
   */
  [k: string]: unknown;
  pattern?: URLPattern;
  status?: ErrorStatus;
  layout?: string;
  /**
   * the default http error pages can be overriden by
   * error page handlers exported from _status.* files.
   */
  render?: _RenderFunc<Context>;
  renderEngines?: string[];
  default?: ErrorHandler["render"];
}
interface Layout {
  /**
   * layout name, defaults to the pathname relative to
   * the `routes/_layouts` directory e.g. `post.njk`
   */
  name?: string;
  /**
   * parent layout to inherit state from and
   * be rendered inside of
   */
  layout?: string;
  /**
   * data to apply to `ctx.state` on render of any route
   * that uses this layout. this data is not accessible to
   * middleware pre-render and will be overridden by keys
   * of the same name that are set directly on the rendered
   * route. the special `renderEngines` and `layout` state
   * keys can be set on a layout but will not be set to
   * `ctx.state` until the layout itself begins rendering
   */
  [k: string]: unknown;
  /**
   * if a page is rendered with the `layout` key of `ctx.state` set,
   * the matching layout will be rendered and served with `ctx.state`
   * passed in object form and the rendered page's html set to the
   * `content` key of that object
   */
  render?: _RenderFunc<Props & Record<"content", unknown>>;
  renderEngines?: string[];
  default?: Layout["render"];
}

type Props = Record<string, unknown>;
interface Component {
  /**
   * component name, defaults to the pathname relative to
   * the `routes/_components` directory e.g. `button.tsx`
   */
  name?: string;
  /**
   * components do not affect or have access to `ctx.state`,
   * but they can still specify which renderers to use via
   * the `renderEngines` property
   */
  render?: _RenderFunc<Props>;
  renderEngines?: string[];
  default?: Component["render"];
}
/**
 * components are rendered asynchronously, but to be used
 * with some templating engines need to return a synchronous
 * value. by overriding the unresolved promise's `toString()`
 * method to return a placeholder (which is then replaced by
 * the actual rendered component at the end of the render process),
 * pseudo-synchronous component rendering is achieved. the actual
 * rendered component can still be accessed by `await`-ing the
 * returned value in an asynchronous context
 */
type _ResolvableComponent = (props?: Props) => Promise<string> & string;

interface Renderer {
  /**
   * engine name, used to manually select an engine or queue
   * multiple engines via the `renderEngines` key of `ctx.state`
   */
  name: string;
  /**
   * specifies which routes this engine can render.
   * renderers are sorted from highest to lowest specificity
   * (e.g. `.tmpl.ts` > `.ts`) to determine the order they
   * should be called on a route in. `*` matches all routes but
   * has the lowest specificity
   */
  targets: ("*" | string)[];
  /**
   * called on targeted routes each time they are requested
   * to transform route data. this must return a string of html.
   *
   * if this is the renderer with the highest priority and the
   * route is a javascript file, the renderer is passed the return
   * value of the route's default export. if the route is any other
   * file type, the renderer is passed the file's contents as a string.
   * all consequent renderers called will be passed the output of the
   * previous renderer. the passed props are `ctx.state` in object form
   * if rendering a page or layout, or a user-provided object when
   * rendering a component. registered components are provided via
   * the `props.comp` object, for referencing components within templates.
   * when rendering a layout, `props.content` is set to the page's contents
   */
  render: (
    template: unknown,
    props:
      & Props
      & Record<"comp", Record<string, _ResolvableComponent>>
      & Record<"filters", Record<string, Filter>>,
  ) => Promisable<string>;
}
/**
 * a generic filter type that can be called from
 * any implementing templating engine (e.g. via
 * {{ name | upper } in nunjucks and liquid,
 * or <%~ filter.upper("name") %> in eta). note:
 * different templating engines may pass arguments
 * differently to filters (e.g. pug will pass text
 * to the first arg and an options object to the
 * second arg, while other templating engines may
 * pass data to any number of arguments)
 */
// deno-lint-ignore no-explicit-any
type Filter = (...args: any[]) => Promisable<string>;

interface Processor {
  /**
   * specifies which files this processor can transform.
   * processors are sorted from highest to lowest specificity
   * (e.g. `.next.css` > `.css`) to determine the order they
   * should be called on a file in. `*` matches all files but
   * has the lowest specificity
   */
  targets: ("*" | string)[];
  /**
   * called once on targeted files on server startup to
   * preprocess file contents, types and/or pathnames
   */
  transform: (file: File) => Promisable<File>;
}

export type {
  _RenderFunc,
  _ResolvableComponent,
  Component,
  Context,
  Data,
  ErrorHandler,
  File,
  Filter,
  Handler,
  HttpMethod,
  Layout,
  Manifest,
  Middleware,
  Processor,
  Promisable,
  Props,
  Renderer,
  Route,
};
export { HttpMethods };
