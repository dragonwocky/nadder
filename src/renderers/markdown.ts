import type { Renderer } from "../server.ts";
import { unified } from "npm:unified@10.1.2";
import remarkParse from "npm:remark-parse@10.0.1";
import remarkGfm from "npm:remark-gfm@3.0.1";
import remarkRehype from "npm:remark-rehype@10.1.0";
import rehypeSanitize from "npm:rehype-sanitize@5.0.1";
import rehypeStringify from "npm:rehype-stringify@9.0.3";

const md = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeStringify);

export default ({
  name: "md",
  targets: [".md"],
  render: async (template) => String(await md.process(String(template))),
}) as Renderer;
