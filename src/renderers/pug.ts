import type { Renderer } from "../server.ts";
import pug from "npm:pug@3.0.2";

export default ({
  name: "pug",
  targets: [".pug"],
  render: (page, state) => pug.render(page, state),
}) as Renderer;
