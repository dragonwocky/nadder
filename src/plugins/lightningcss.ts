import browserslist from "npm:browserslist@4.21.5";
import init, {
  browserslistToTargets,
  type CustomAtRules,
  transform,
  type TransformOptions,
} from "npm:lightningcss-wasm@1.19.0";
import type { Processor, Transformer } from "../server.ts";
import { type Element } from "../server/deps.ts";

let _setupCalled = false;
type Config<C extends CustomAtRules = Record<string, never>> =
  & Omit<
    TransformOptions<C>,
    "filename" | "code"
  >
  & { inlineSelector: string };
const config: Config = {
    minify: true,
    drafts: { nesting: true, customMedia: true },
    targets: browserslistToTargets(browserslist(">= 0.25% and not dead")),
    inlineSelector: "style:not(data-preserve)",
  },
  setup = async <C extends CustomAtRules>(
    options: Partial<Config<C>> = {},
  ) => {
    await init();
    _setupCalled = true;
    Object.assign(config, options);
  };

const processor: Processor = async (document) => {
    if (!_setupCalled) await setup();
    const styleElems = document.querySelectorAll(config.inlineSelector);
    for (const $style of [...styleElems] as Element[]) {
      try {
        const { code } = transform({
          ...config,
          filename: "styles.css",
          code: new TextEncoder().encode($style.innerText),
        });
        $style.innerText = new TextDecoder().decode(code);
      } catch { /* */ }
    }
  },
  transformer: Transformer = {
    targets: [".css"],
    async transform(file) {
      if (!_setupCalled) await setup();
      try {
        const css = typeof file.content === "string"
            ? new TextEncoder().encode(file.content)
            : file.content,
          { code } = transform({
            ...config,
            filename: "styles.css",
            code: css,
          });
        file.content = code;
      } catch { /* */ }
      return file;
    },
  };

export { type Config, processor, setup, transformer };
