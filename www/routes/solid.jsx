/** @jsx h */

import { createSignal, onCleanup } from "npm:solid-js";
import * as solid from "npm:solid-js/web";
// import h from "npm:solid-js/h";

const h = (type, attrs) => {
  console.log(args);
  if (typeof type === "function") return String(type(attrs));
  return String(args);
};

const CountingComponent = () => {
  const [count, setCount] = createSignal(0);
  const interval = setInterval(() => setCount((c) => c + 1), 1000);
  onCleanup(() => clearInterval(interval));
  return <div>Count value is {count()}</div>;
};

export const render = () => <CountingComponent />;
if ("document" in globalThis) {
  solid.render(() => <CountingComponent />, document.getElementById("app"));
}
