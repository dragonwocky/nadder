import manifest from "./manifest.gen.ts";
import { start, useRenderer } from "../src/server.ts";
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
  name: "njk",
  targets: [".njk"],
  render: (page, state) => njk.renderString(page, state),
});
useRenderer({
  name: "md",
  targets: [".md"],
  render: async (page) => String(await md.process(<string> page)),
});

start(manifest);
