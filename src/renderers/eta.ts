import type { Renderer } from "../server.ts";
import * as eta from "https://deno.land/x/eta@v2.0.0/mod.ts";

export default ({
  name: "eta",
  targets: [".eta"],
  render: (template, props) => eta.render(String(template), props),
}) as Renderer;
