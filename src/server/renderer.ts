import {
  getComponents,
  getFilters,
  getLayout,
  getLayoutData,
  getRenderer,
} from "./hooks.ts";
import type {
  _RenderFunc,
  _ResolvableComponent,
  Context,
  Props,
  Renderer,
} from "./types.ts";

interface _RenderArgs<P> {
  renderFunc?: _RenderFunc<P>;
  renderEngines?: string[];
  renderProps: P;
  engineProps: Props;
}
const renderComponent = async <P>(ctx: Context, {
  renderFunc,
  renderEngines,
  renderProps,
  engineProps,
}: _RenderArgs<P>) => {
  const components = getResolvableComponents(ctx),
    filters = getFilters();
  let content = await renderFunc?.(renderProps, components, filters);
  if (renderEngines) {
    const engines = renderEngines.map(getRenderer)
        .filter((engine): engine is Renderer["render"] => !!engine),
      props = { ...engineProps, comp: components, filters };
    for (const engine of engines) content = await engine(content, props);
  }
  return content;
};

const _componentCache = new WeakMap(),
  getResolvableComponents = (ctx: Context) => {
    if (_componentCache.has(ctx)) return _componentCache.get(ctx);
    const components = getComponents(),
      resolvable: Record<string, _ResolvableComponent> = {};
    for (const key in components) {
      resolvable[key] = (props = {}) => {
        const res = renderComponent(ctx, {
            renderFunc: components[key].render,
            renderEngines: components[key].renderEngines,
            renderProps: props,
            engineProps: props,
          }),
          id = crypto.randomUUID().replace(/-/g, "");
        ctx.state.set(`_comp_${id}`, res);
        res.toString = () => `<!--<Component id="${id}" />-->`;
        return res as Promise<string> & string;
      };
    }
    _componentCache.set(ctx, resolvable);
    return resolvable;
  },
  resolveComponents = async (ctx: Context, content: string) => {
    const pattern = /<!--<Component\sid=["|']([a-zA-Z10-9]+)["|']\s\/>-->/;
    while (pattern.test(content)) {
      const [, id] = content.match(pattern)!,
        comp = await ctx.state.get(`_comp_${id}`);
      content = content.replace(pattern, comp ?? "");
    }
    return content;
  };

const renderLayout = async (
    ctx: Context,
    props: Props,
    content: unknown,
  ): Promise<string> => {
    while (ctx.state.get("layout")) {
      const layout = getLayout(ctx.state.get("layout"));
      ctx.state.set("layout", layout?.layout);
      content = await renderComponent(ctx, {
        renderFunc: layout?.render,
        renderEngines: layout?.renderEngines,
        renderProps: { ...props, content },
        engineProps: { ...props, content },
      }) ?? content;
    }
    return String(content);
  },
  renderPage = async (ctx: Context, render: _RenderFunc<Context>) => {
    // assign layout data at start of render chain
    const data = getLayoutData(ctx.state.get("layout"));
    for (const key in data) {
      // route-specific data has priority over layout data
      if (!ctx.state.has(key)) ctx.state.set(key, data[key]);
    }

    // render page into nested layouts
    const props = Object.fromEntries(ctx.state),
      content = await renderComponent(ctx, {
        renderFunc: render,
        renderEngines: ctx.state.get("renderEngines"),
        renderProps: ctx,
        engineProps: props,
      });
    return resolveComponents(ctx, await renderLayout(ctx, props, content));
  };

export { renderPage };
