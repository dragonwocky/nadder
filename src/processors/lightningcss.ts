import init, {
  browserslistToTargets,
  transform,
} from "npm:lightningcss-wasm@1.19.0";
import browserslist from "npm:browserslist@4.21.5";

await init();
const targets = browserslistToTargets(browserslist(">= 0.25% and not dead"));

// const { code, map } = transform({
//   filename: "uno.css",
//   code: new TextEncoder().encode(css),
//   minify: true,
//   drafts: { nesting: true, customMedia: true },
//   targets,
// });
// css = new TextDecoder().decode(code);
