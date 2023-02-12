// import { start } from "../src/server/listen.ts";
// import { registerPlugin } from "../src/server/plugins.ts";
// import plaintext from "../src/plugins/plaintext.ts";
import type { Manifest } from "nadder/types.ts";
import { start } from "../src/server/listen.ts";

const manifest: Manifest = {
  routes: {
    "/_middleware.ts": { ...await import("./routes/_middleware.ts") },
  },
  baseUrl: new URL("./", import.meta.url),
};

start({ ...manifest });

// const staticFiles = await processStaticFiles(await indexStaticFiles(manifest));

// registerPlugin({ routePostprocessor: (body) => `<b>${body}</b>` });
// registerPlugin(plaintext);

// start(manifest);

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
