import type { Renderer } from "../server.ts";
import { Liquid } from "npm:liquidjs@10.5.0";

const engine = new Liquid();

export default ({
  name: "liquid",
  targets: [".liquid"],
  render: (page, state) => engine.parseAndRender(String(page), state),
}) as Renderer;
