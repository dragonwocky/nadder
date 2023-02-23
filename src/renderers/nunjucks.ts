import type { Renderer } from "../server.ts";
import njk from "npm:nunjucks@3.2.3";

export default ({
  name: "njk",
  targets: [".njk"],
  render: (template, props) => njk.renderString(String(template), props),
}) as Renderer;
