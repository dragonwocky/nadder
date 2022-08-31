import { contentType, Status, STATUS_TEXT } from "./deps.ts";
import { renderRoute } from "./handlers.ts";
import type { Context, RouteFile } from "./types.ts";

const errorPages: Map<Status, RouteFile> = new Map(),
  setErrorPage = (status: Status, route: RouteFile) => {
    // pass a path and fetch the route instead?
    errorPages.set(status, route);
  };

const errorMessages: Map<Status, string> = new Map(),
  setErrorMessage = (status: Status, message: string) => {
    errorMessages.set(status, message);
  };

const createErrorMessageResponse = (status: Status) => {
    const message = errorMessages.get(status) ??
      `${status} ${STATUS_TEXT[status]}`;
    return new Response(message, { status });
  },
  createErrorPageResponse = async (ctx: Context, status: Status) => {
    if (errorPages.get(status)) {
      const html = await renderRoute({ ...ctx, file: errorPages.get(status)! }),
        headers = new Headers({ "content-type": contentType("html") });
      if (html) return new Response(html, { status, headers });
    }
    return createErrorMessageResponse(status);
  };

const createNotFoundResponse = (ctx: Context) => {
    return createErrorPageResponse(ctx, Status.NotFound);
  },
  createInternalServerErrorResponse = (
    ctx: Context,
    error?: Error | string,
  ) => {
    console.error(error);
    ctx.state.set("error", error);
    try {
      return createErrorPageResponse(ctx, Status.InternalServerError);
    } catch (error) {
      console.error(error);
      return createErrorMessageResponse(Status.InternalServerError);
    }
  };

export {
  createInternalServerErrorResponse,
  createNotFoundResponse,
  setErrorMessage,
  setErrorPage,
};
