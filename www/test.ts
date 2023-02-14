// import { start } from "../src/server/listen.ts";
// import { registerPlugin } from "../src/server/plugins.ts";
// import plaintext from "../src/plugins/plaintext.ts";
import type { Manifest } from "../src/server/types.ts";
import { start, useRenderer } from "../src/server.ts";

const manifest: Manifest = {
  routes: {
    "/_middleware.ts": { ...await import("./routes/_middleware.ts") },
    "/lag.ts": { ...await import("./routes/lag.ts") },
  },
  baseUrl: new URL("./", import.meta.url),
};

import njk from "npm:nunjucks";
import { unified } from "npm:unified";
import remarkParse from "npm:remark-parse";
import remarkFrontmatter from "npm:remark-frontmatter";
import remarkGfm from "npm:remark-gfm";
import remarkRehype from "npm:remark-rehype";
import rehypeStringify from "npm:rehype-stringify";

const md = unified()
  .use(remarkParse)
  .use(remarkFrontmatter)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeStringify);

useRenderer({
  id: "njk",
  targets: [".njk"],
  render: (page, ctx) => {
    return njk.renderString(page, Object.fromEntries(ctx.state.entries()));
  },
});
useRenderer({
  id: "md",
  targets: [".md"],
  render: async (page) => String(await md.process(<string> page)),
});

start({ ...manifest });

// const staticFiles = await processStaticFiles(await indexStaticFiles(manifest));

// registerPlugin({ routePostprocessor: (body) => `<b>${body}</b>` });
// registerPlugin(plaintext);

// start(manifest);

/**
 * [] layouts
 * [] components
 * [] error pages
 * [] route factories (via middleware?)
 * [] pretty urls (/about = /about/index.html = /about.html
 *    via \/about((\.html)|(\/index\.html))?)
 * [] generate static output (out of scope?)
 * [] multiple template engines (e.g. njk for vars, md for html?)
 * [] remote files (fwding)
 * [] interactive islands (via components + plugins?)
 * [] helpers/filters (e.g. for internationalisation)
 */
