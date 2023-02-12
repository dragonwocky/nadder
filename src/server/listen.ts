import type { Manifest } from "../types.ts";

import { serve, type ServeInit } from "std/http/mod.ts";
import { composeResponse, indexRoutes } from "./context.ts";

const start = async (manifest: Manifest, serveInit: ServeInit = {}) => {
  manifest.ignorePattern ??= /\/(\.|_)/g;
  serveInit.onListen = serveInit.onListen ?? (({ hostname, port }) => {
    console.log(`Server listening on http://${hostname}:${port}/`);
  });

  await indexRoutes(manifest);
  return serve(composeResponse, serveInit);
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
