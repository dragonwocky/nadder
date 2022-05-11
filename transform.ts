/*! mit license (c) dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/) */

import {
  autoprefixer,
  gfm,
  gfmHtml,
  hljs,
  HtmlExtension,
  math,
  mathHtml,
  micromark,
  postcss,
  selectorParser,
  swc,
  valueParser,
} from "./deps.ts";

// modified from https://github.com/jake-low/postcss-minify/blob/master/index.js
const selectorProcessor = selectorParser((selectors) =>
    selectors.walk((selector) => {
      selector.spaces = { before: "", after: "" };
      // @ts-expect-error: raw may not exist on all nodes
      if (selector?.raws?.spaces) selector.raws.spaces = {};
    })
  ),
  valueMinifier = (value: string) => {
    const parsed = valueParser(value.trim());
    parsed.walk((node) => {
      // @ts-expect-error: before may not exist on all nodes
      if (node.before) node.before = "";
      // @ts-expect-error: after may not exist on all nodes
      if (node.after) node.after = "";
      if (node.type === "space") node.value = " ";
    });
    return parsed.toString();
  },
  cssMinifier: Parameters<typeof postcss>[0] = {
    postcssPlugin: "postcss-minify",
    AtRule: (atrule) => {
      atrule.raws = { before: "", after: "", afterName: " " };
      atrule.params = valueMinifier(atrule.params);
    },
    Comment: (comment) => {
      if (comment.text[0] === "!") {
        comment.raws.before = "";
        comment.raws.after = "";
      } else comment.remove();
    },
    Declaration: (decl) => {
      decl.raws = { before: "", between: ":" };
      decl.value = valueMinifier(decl.value);
    },
    Rule: (rule) => {
      rule.raws = { before: "", between: "", after: "", semicolon: false };
      rule.selector = selectorProcessor.processSync(rule.selector);
    },
  };

// hijacking https://github.com/micromark/micromark/blob/main/packages/micromark/dev/lib/compile.js
const hljsHtml: HtmlExtension = {
    enter: {
      codeFenced() {
        this.lineEndingIfNeeded();
        this.tag("<pre><code");
        this.setData("fencesCount", 0);
      },
    },
    exit: {
      codeFencedFenceInfo() {
        const codeLang = this.resume();
        this.tag(` class="language-${codeLang}"`);
        this.setData("codeLang", codeLang);
      },
      codeFlowValue(token) {
        const codeLines = this.getData("codeLines") as string[] ?? [];
        codeLines.push(this.sliceSerialize(token));
        this.setData("codeLines", codeLines);
        this.setData("slurpOneLineEnding", true);
      },
      codeFenced() {
        const codeLines = this.getData("codeLines") as string[] ?? [],
          codeLang = this.getData("codeLang") as string ?? "",
          fencesCount = this.getData("fencesCount");

        const code = codeLang
          ? hljs.highlight(codeLines.join("\n"), { language: codeLang }).value
          : codeLines.join("\n");
        this.raw(code);

        // special case: fence not closed, micromark considers following line ending
        // outside code block, commonmark wants to treat it as part of the code
        const stillWithinFences = fencesCount !== undefined && fencesCount < 2,
          runsToEndOfContainer = stillWithinFences &&
            // @ts-expect-error: `tightStack` is always set.
            data.tightStack.length > 0 &&
            !this.getData("lastWasTag");
        if (runsToEndOfContainer) this.raw("\n");

        if (this.getData("flowCodeSeenData")) this.lineEndingIfNeeded();
        this.tag("</code></pre>");
        if (stillWithinFences) this.lineEndingIfNeeded();

        // reset data
        this.setData("flowCodeSeenData");
        this.setData("fencesCount");
        this.setData("slurpOneLineEnding");
        this.setData("codeLang");
        this.setData("codeLines");
      },
    },
  },
  // allow <details><summary></summary></details>, escape other html
  detailsHtml: HtmlExtension = {
    exit: {
      htmlFlowData(token) {
        const re = /<\/{0,1}(?:details|summary)(?:.{0}|\s[^>]+?)>/g,
          value = this.sliceSerialize(token),
          flow: string[] = [];
        let match, i = 0;
        while ((match = re.exec(value)) != null) {
          const start = match.index,
            end = match.index + match[0].length;
          flow.push(this.encode(value.slice(i, start)));
          flow.push(value.slice(start, end));
          i = end;
        }
        flow.push(this.encode(value.slice(i)));
        this.raw(flow.join(""));
      },
      htmlTextData(token) {
        detailsHtml.exit!.htmlFlowData.call(this, token);
      },
    },
  };

const _script = (script: string, syntax: "typescript" | "ecmascript") => {
    const { code } = swc.transform(script, {
      // @ts-expect-error: missing deno_swc type definitions
      minify: true,
      jsc: {
        minify: { compress: true, mangle: { topLevel: true } },
        target: "es2019",
        parser: { syntax },
      },
      module: { type: "es6" },
    });
    return code;
  },
  _stylesheet = (css: string) => {
    return postcss([autoprefixer as Parameters<typeof postcss>[0], cssMinifier])
      .process(css).css;
  },
  _markdown = (md: string) => {
    return micromark(md, "utf8", {
      extensions: [gfm(), math()],
      htmlExtensions: [gfmHtml(), mathHtml(), hljsHtml, detailsHtml],
    });
  };

const cache: Map<string, string> = new Map(),
  processors: Map<string, (code: string) => string> = new Map([
    ["ts", (ts: string) => _script(ts, "typescript")],
    ["js", (js: string) => _script(js, "ecmascript")],
    ["css", _stylesheet],
    ["md", _markdown],
  ]),
  transform = (lang: "ts" | "js" | "css" | "md" | string, code: string) => {
    if (!cache.has(code)) {
      cache.set(code, processors.get(lang)?.(code) ?? code);
    }
    return cache.get(code)!;
  };

const files: Map<string, [number, string]> = new Map(),
  transformFile = async (path: string) => {
    try {
      const { mtime, isFile } = await Deno.stat(path);
      if (!isFile || !mtime) return undefined;
      if (files.has(path)) {
        const [atime] = files.get(path)!,
          expired = mtime.getTime() !== atime;
        if (expired) files.delete(path);
      }
      if (!files.has(path)) {
        const file = await Deno.readTextFile(path);
        files.set(path, [mtime.getTime(), file]);
      }
      const lang = path.endsWith(".mjs") ? "js" : path.split(".").at(-1) ?? "",
        [, file] = files.get(path)!;
      return transform(lang, file);
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) return undefined;
      throw err;
    }
  };

// bundle: --unstable
// const { files } = await Deno.emit(path, { bundle: "module", check: false }),
//   bundle = transform(files["deno:///bundle.js"]);

export { transform, transformFile };
