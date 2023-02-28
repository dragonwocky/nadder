import type { Renderer } from "../server.ts";
import { transformAsync } from "npm:@babel/core";
import solid from "npm:babel-preset-solid@1.6.10";

const opts = { presets: [solid({ generate: "ssr" })] },
  renderer: Renderer = {
    name: "solidjs",
    targets: [".tsx", ".jsx"],
    render: async (tmpl, props) => {
      console.log(tmpl);
      const { code } = await transformAsync(tmpl, opts);
      tmpl = code.replaceAll(
        'from "solid-js',
        'from "https://esm.sh/solid-js@1.6.11',
      );
      // file.type = "text/javascript";
      return tmpl as string;
    },
  };

export { renderer };
