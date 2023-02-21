import { type Component } from "nadder/server.ts";

export default ((props) => {
  return `<button>${props.name}</button>`;
}) as Component["default"];
