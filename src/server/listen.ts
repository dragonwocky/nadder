import type { ServeInit } from "./deps.ts";
import type { Manifest } from "./types.ts";

import { serve } from "./deps.ts";
import { createRouteResponse, indexRoutes } from "./handlers.ts";

const start = async (manifest: Manifest, serveInit: ServeInit = {}) => {
  manifest.ignorePattern ??= /\/(\.|_)/g;
  serveInit.onListen = serveInit.onListen ?? (({ hostname, port }) => {
    console.log(`Server listening on http://${hostname}:${port}/`);
  });

  const routeFiles = await indexRoutes(manifest);

  return serve(async (req, connInfo) => {
    //   try {
    //     const removeTrailingSlashesRedirect = removeTrailingSlashFromReqPath(req);
    //     if (removeTrailingSlashesRedirect) return removeTrailingSlashesRedirect;

    //     const patternMatched = filterMiddlewareByPattern(req, middleware),
    //       methodMatched = filterMiddlewareByMethod(req, patternMatched),
    //       patternMatchedHasRouteOrFileHandler = patternMatched
    //         .some(({ isRouteOrFileHandler }) => isRouteOrFileHandler),
    //       methodMatchedHasRouteOrFileHandler = methodMatched
    //         .some(({ isRouteOrFileHandler }) => isRouteOrFileHandler),
    //       shouldSendMethodNotAllowedResponse =
    //         patternMatchedHasRouteOrFileHandler &&
    //         !methodMatchedHasRouteOrFileHandler;
    //     if (shouldSendMethodNotAllowedResponse) {
    //       return createMethodNotAllowedRes(patternMatched);
    //     } else if (methodMatchedHasRouteOrFileHandler) {
    //       return composeMiddlewareHandlers(methodMatched, { req, connInfo });
    //     } else return await onNotFound({ url: new URL(req.url) });
    //   } catch (e) {
    //     return await onInternalServerError({
    //       url: new URL(req.url),
    //       error: e instanceof Error ? e : new Error(e),
    //     });
    //   }

    return await createRouteResponse(req, {
      url: new URL("http://localhost/index.html"),
      state: new Map(),
      params: {},
      file: routeFiles.find((r) => r.frontmatter)!,
    });
  }, serveInit);
};

export { start };

/**
 * [x] static file serving
 * [x] static file processing
 * [x] route renderering
 * [x] route preprocessing
 * [x] route postprocessing
 * [x] ignored files
 * [] layouts
 * [] components
 * [1/2] error pages
 * [1/2] cache busting & etags
 * [x] route-level frontmatter data
 * [] shared data (via middleware?)
 * [1/2] pretty urls (/about = /about/index.html = /about.html
 *    via \/about((\.html)|(\/index\.html))?)
 * [] multiple template engines (e.g. njk for vars, md for html?)
 * [] remote files (fwding)
 * [] interactive islands (via components + plugins?)
 * [] helpers/filters (e.g. for internationalisation)
 */
