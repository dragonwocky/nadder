import { Component } from "nadder/server.ts";

export const title = "Title";

export default ((ctx) => {
  return `<button>
  ${ctx.state.get("content")}
</button>`;
}) as Component["default"];
