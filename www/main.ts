import {
  eta,
  lightningcss,
  liquid,
  md,
  njk,
  pug,
  solidjs,
  unocss,
} from "nadder/plugins.ts";
import { start, useFilter, usePlugin } from "nadder/server.ts";
import manifest from "./manifest.gen.ts";

[
  eta,
  lightningcss,
  liquid,
  md,
  njk,
  pug,
  unocss,
  solidjs,
].forEach(usePlugin);
unocss.setup({ outputMode: "styleTag", compileClasses: true });

useFilter("uppercase", (s) => s.toUpperCase());

start(manifest);
