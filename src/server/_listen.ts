import { serve, type ServeInit, Status, STATUS_TEXT } from "std/http/mod.ts";
import { contentType } from "std/media_types/mod.ts";
import { isVNode, type VNode } from "vue";

import {
  buildStaticFileCache,
  composeMiddlewareHandlers,
  createMethodNotAllowedRes,
  extractErrHandlersFromRoutes,
  filterMiddlewareByMethod,
  filterMiddlewareByPattern,
  genMiddlewareFromRoutes,
  genMiddlewareFromStaticFiles,
  removeTrailingSlashFromReqPath,
  sortMiddlewarePriorityFirst,
} from "./context.ts";
import {
  type ErrorHandler,
  type ErrorHandlerProps,
  type Manifest,
} from "./types.ts";
import { render } from "./render.tsx";

const defaultNotFoundHandler: ErrorHandler = ({ url }) => {
    const status = Status.NotFound,
      body = `${status} ${STATUS_TEXT[status]}: ${url.pathname}`;
    return new Response(body, { status });
  },
  defaultInternalServerErrorHandler: ErrorHandler = ({ error }) => {
    const status = Status.InternalServerError,
      body = `${status} ${STATUS_TEXT[status]}: ${error?.stack}`;
    return new Response(body, { status });
  };

const start = async (manifest: Manifest, serveInit: ServeInit = {}) => {
  serveInit.onListen = serveInit.onListen ?? (({ hostname, port }) => {
    console.log(`Server listening on http://${hostname}:${port}/`);
  });

  const boundRender = (component: VNode) => {
      return render(manifest, component);
    },
    baseUrl = new URL("./", manifest.baseUrl).href,
    staticFiles = await buildStaticFileCache(baseUrl),
    staticFileMiddleware = genMiddlewareFromStaticFiles(staticFiles),
    routeMiddleware = genMiddlewareFromRoutes(manifest.routes, {
      baseUrl,
      boundRender,
    }),
    middleware = sortMiddlewarePriorityFirst([
      ...staticFileMiddleware,
      ...routeMiddleware,
    ]);

  const errorHandlers = extractErrHandlersFromRoutes(manifest.routes, baseUrl),
    onNotFound = async (props: ErrorHandlerProps) => {
      const res = await (errorHandlers[Status.NotFound] ??
        defaultNotFoundHandler)(props);
      if (isVNode(res)) {
        const body = await boundRender(res),
          status = Status.NotFound,
          headers = new Headers({ "content-type": contentType("html") });
        return new Response(body, { status, headers });
      } else return res;
    },
    onInternalServerError = async (props: ErrorHandlerProps) => {
      const error = props.error!,
        res = await (errorHandlers[Status.InternalServerError] ??
          defaultInternalServerErrorHandler)(props);
      console.error(
        `%c${error.name}: ${error.message}`,
        "color:red",
        `\n${error.stack?.split("\n").slice(1).join("\n")}`,
      );
      if (isVNode(res)) {
        const body = await boundRender(res),
          status = Status.InternalServerError,
          headers = new Headers({ "content-type": contentType("html") });
        return new Response(body, { status, headers });
      } else return res;
    };

  return serve(async (req, connInfo) => {
    try {
      const removeTrailingSlashesRedirect = removeTrailingSlashFromReqPath(req);
      if (removeTrailingSlashesRedirect) return removeTrailingSlashesRedirect;

      const patternMatched = filterMiddlewareByPattern(req, middleware),
        methodMatched = filterMiddlewareByMethod(req, patternMatched),
        patternMatchedHasRouteOrFileHandler = patternMatched
          .some(({ isRouteOrFileHandler }) => isRouteOrFileHandler),
        methodMatchedHasRouteOrFileHandler = methodMatched
          .some(({ isRouteOrFileHandler }) => isRouteOrFileHandler),
        shouldSendMethodNotAllowedResponse =
          patternMatchedHasRouteOrFileHandler &&
          !methodMatchedHasRouteOrFileHandler;
      if (shouldSendMethodNotAllowedResponse) {
        return createMethodNotAllowedRes(patternMatched);
      } else if (methodMatchedHasRouteOrFileHandler) {
        return composeMiddlewareHandlers(methodMatched, { req, connInfo });
      } else return await onNotFound({ url: new URL(req.url) });
    } catch (e) {
      return await onInternalServerError({
        url: new URL(req.url),
        error: e instanceof Error ? e : new Error(e),
      });
    }
  }, serveInit);
};

export { start };
