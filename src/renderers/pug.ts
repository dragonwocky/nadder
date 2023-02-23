import type { Renderer } from "../server.ts";
import pug from "npm:pug@3.0.2";

export default ({
  name: "pug",
  targets: [".pug"],
  render: (template, props) => pug.render(String(template), props),
}) as Renderer;
