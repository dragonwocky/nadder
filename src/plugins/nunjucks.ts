import type { Renderer } from "../server.ts";
import { Environment } from "npm:nunjucks@3.2.3";
import { Filter } from "../server/types.ts";

type _Callback = (err: Error | null, res?: string) => void;
const njk = new Environment(),
  // wraps filters to use the async callbacks njk expects to be used
  // https://github.com/lumeland/lume/blob/master/plugins/nunjucks.ts#L251-L262
  wrapAsyncFilter = (filter: Filter) => {
    return async (...args: unknown[]) => {
      const callback = args.pop() as _Callback;
      try {
        callback(null, await filter(...args));
      } catch (err) {
        callback(err);
      }
    };
  };

const renderer: Renderer = {
  name: "njk",
  targets: [".njk"],
  render: (template, props) => {
    for (const name in props.filters) {
      // treating all filters as async simplifies
      // filter registration and handling
      const filter = wrapAsyncFilter(props.filters[name]);
      njk.addFilter(name, filter, true);
    }
    return new Promise((res, rej) => {
      const handleAsync: _Callback = (e, r) => e ? rej(e) : res(r!);
      njk.renderString(String(template), props, handleAsync);
    });
  },
};

export { renderer };
