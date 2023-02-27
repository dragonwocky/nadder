import type { Filter, Renderer } from "../server.ts";
import { type Plugin, type Processor, unified } from "npm:unified@10.1.2";
import remarkParse from "npm:remark-parse@10.0.1";
import remarkGfm from "npm:remark-gfm@3.0.1";
import remarkRehype from "npm:remark-rehype@10.1.0";
import rehypeSanitize from "npm:rehype-sanitize@5.0.1";
import rehypeStringify from "npm:rehype-stringify@9.0.3";

let md: Processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeStringify);
const setup = (plugins: Plugin[]) => {
    md = unified();
    for (const plugin of plugins) md = md.use(plugin);
  },
  process = async (str: unknown) => String(await md.process(String(str)));

const renderer: Renderer = {
    name: "md",
    targets: [".md"],
    render: async (template) => await process(String(template)),
  },
  filters: Record<string, Filter> = { "md": process };

export { filters, renderer, setup };
