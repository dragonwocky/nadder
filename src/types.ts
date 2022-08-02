import { type ConnInfo } from "std/http/mod.ts";
import { type VNode } from "vue";

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
interface StatusResponseInit extends ResponseInit {
  bodyInit?: BodyInit | null;
}

interface Manifest {
  routes: Record<
    string,
    | Route
    | { default: Middleware["handler"] }
    | { default: ErrorHandler }
  >;
  // import.meta.url of manifest file (in project root)
  baseUrl: string;
  htmlLang: string;
}

interface MiddlewareHandlerContext<State = Map<string, unknown>>
  extends ConnInfo {
  url: URL;
  next: () => Response | Promise<Response>;
  state: State;
}
interface Middleware<State = Map<string, unknown>> {
  pattern: URLPattern;
  method: HttpMethod;
  handler(
    req: Request,
    ctx: MiddlewareHandlerContext<State>,
  ): Response | Promise<Response>;
  isRouteOrFileHandler?: boolean;
}

interface RouteHandlerContext<State = Map<string, unknown>> extends ConnInfo {
  params: Record<string, string | string[]>;
  render: <Data>(
    data?: Data,
  ) => undefined | Response | Promise<Response | undefined>;
  state: State;
}
type Route<State = Map<string, unknown>> =
  & {
    [k in HttpMethod]?: (
      req: Request,
      ctx: RouteHandlerContext<State>,
    ) => Response | Promise<Response>;
  }
  & {
    pattern?: URLPattern;
    default?: <Data>(
      props: PageProps<Data>,
    ) => VNode;
  };
interface PageProps<Data = unknown> {
  url: URL;
  params: Record<string, string | string[]>;
  data?: Data;
}

type ErrorHandler = (
  props: ErrorHandlerProps,
) => VNode | Response | Promise<VNode | Response>;
interface ErrorHandlerProps {
  url: URL;
  error?: Error;
}

interface StaticFile {
  localUrl: URL;
  publicPath: string;
  sizeInBytes: number;
  contentType: string;
  // hash of the file's contents
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag
  entityTag: string;
}

export {
  type ErrorHandler,
  type ErrorHandlerProps,
  type HttpMethod,
  type Manifest,
  type Middleware,
  type MiddlewareHandlerContext,
  type PageProps,
  type Route,
  type RouteHandlerContext,
  type StaticFile,
  type StatusResponseInit,
};
