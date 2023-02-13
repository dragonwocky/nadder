import { serve, type ServeInit } from "std/http/mod.ts";
import { indexRoutes, indexStatic } from "./context.ts";
import { handleRequest } from "./listen.ts";
import type { Manifest } from "./types.ts";

const start = async (manifest: Manifest, serveInit: ServeInit = {}) => {
  manifest.ignorePattern ??= /\/(\.|_)/g;
  serveInit.onListen = serveInit.onListen ?? (({ hostname, port }) => {
    console.log(`Server listening on http://${hostname}:${port}/`);
  });

  await Promise.all([indexRoutes(manifest), indexStatic(manifest)]);
  return serve(handleRequest, serveInit);
};

export { useData, useMiddleware, useProcessor, useRenderer } from "./hooks.ts";
export { start };

/**
 * [] static file serving
 * [] static file processing
 * [x] route renderering
 * [] route preprocessing
 * [] route postprocessing
 * [x] ignored files
 * [] layouts
 * [] components
 * [1/2] error pages
 * [1/2] cache busting & etags
 * [x] route-level frontmatter data
 * [x] shared data (via middleware?)
 * [-] pretty urls (/about = /about/index.html = /about.html
 *    via \/about((\.html)|(\/index\.html))?)
 * [] multiple template engines (e.g. njk for vars, md for html?)
 * [] remote files (fwding)
 * [] interactive islands (via components + plugins?)
 * [] helpers/filters (e.g. for internationalisation)
 */
