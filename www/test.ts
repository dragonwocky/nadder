import { type Manifest } from "../src/types.ts";
import { plaintext } from "../src/plugins.ts";
import {
  indexRouteFiles,
  indexStaticFiles,
  processRoute,
  processStaticFiles,
  registerPlugin,
} from "../src/server.ts";

const manifest: Manifest = {
  routes: {},
  baseUrl: import.meta.url,
};

// const staticFiles = await processStaticFiles(await indexStaticFiles(manifest));

registerPlugin({ routePostprocessor: (body) => `<b>${body}</b>` });
registerPlugin(plaintext);

const routeFiles = await indexRouteFiles(manifest);

console.log(
  await processRoute({
    url: new URL("http://localhost/index.html"),
    state: new Map(),
    params: {},
    file: routeFiles.find((r) => r.pathname.endsWith(".txt"))!,
  }),
);

/**
 * [x] static file serving
 * [x] static file processing
 * [x] route renderering
 * [x] route preprocessing
 * [x] route postprocessing
 * [] ignored files
 * [] layouts
 * [] components
 * [] error pages
 * [] cache busting & etags
 * [] redirects (via middleware?)
 * [x] route-level frontmatter data
 * [] shared data (via middleware?)
 * [] route factories (via middleware?)
 * [] pretty urls (/about = /about/index.html = /about.html
 *    via \/about((\.html)|(\/index\.html))?)
 * [] generate static output (out of scope?)
 * [] multiple template engines (e.g. njk for vars, md for html?)
 * [] remote files (fwding)
 * [] interactive islands (via components + plugins?)
 * [] helpers/filters (e.g. for internationalisation)
 */
