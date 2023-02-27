import type { Filter, Renderer } from "../server.ts";
import pug from "npm:pug@3.0.2";

const renderer: Renderer = {
  name: "pug",
  targets: [".pug"],
  render: (template, props) => {
    const filters: Record<string, Filter> = {};
    for (const name in props.filters) {
      filters[name] = (text: string, opts: Record<string, unknown>) => {
        delete opts.filename;
        return props.filters[name](text, opts);
      };
    }
    return pug.render(String(template), { ...props, filters });
  },
};

export { renderer };
