import type { Renderer } from "../server.ts";
import njk from "npm:nunjucks@3.2.3";

export default ({
  name: "njk",
  targets: [".njk"],
  render: (page, state) => njk.renderString(page, state),
}) as Renderer;
