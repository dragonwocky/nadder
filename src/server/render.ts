import {
  getComponents,
  getLayout,
  getLayoutData,
  getRenderer,
} from "./hooks.ts";
import type {
  _RenderFunction,
  _ResolvableComponent,
  Component,
  Context,
  Props,
} from "./types.ts";

const getResolvableComponents = (ctx: Context) => {
    const components = getComponents(),
      resolvable: Record<string, _ResolvableComponent> = {};
    for (const key in components) {
      resolvable[key] = (props) => {
        const res = renderComponent(ctx, components[key], props),
          id = crypto.randomUUID().replace(/-/g, "");
        ctx.state.set(`_comp_${id}`, res);
        res.toString = () => `<!--<Component id="${id}" />-->`;
        return res as Promise<string> & string;
      };
    }
    return resolvable;
  },
  resolveComponents = async (ctx: Context, content: string) => {
    const pattern = /<!--<Component\sid=["|']([a-zA-Z10-9]+)["|']\s\/>-->/;
    while (pattern.test(content)) {
      const [, id] = content.match(pattern)!,
        comp = await (ctx.state.get(`_comp_${id}`) as Promise<string>);
      content = content.replace(pattern, comp ?? "");
    }
    return content;
  },
  renderComponent = async (ctx: Context, comp: Component, props: Props) => {
    let content = await comp.render?.(props, getResolvableComponents(ctx));
    const engines = (comp.renderEngines ?? [])
      .map(getRenderer).filter((engine) => engine);
    for (const engine of engines) content = await engine!(content ?? "", props);
    return String(content);
  };

const _renderPage = async (
    ctx: Context,
    render: _RenderFunction,
  ): Promise<string> => {
    let content = await render?.(ctx, getResolvableComponents(ctx));
    const engines = (ctx.state.get("renderEngines") as string[] ?? [])
        .map(getRenderer).filter((engine) => engine),
      state = Object.fromEntries(ctx.state.entries());
    for (const engine of engines) content = await engine!(content ?? "", state);

    const layout = getLayout(ctx.state.get("layout") as string);
    if (!layout) return String(content);
    ctx.state.set("content", content);
    ctx.state.set("layout", layout.layout);
    ctx.state.set("renderEngines", layout.renderEngines);
    return _renderPage(ctx, layout.render as _RenderFunction<unknown>);
  },
  renderPage = async (ctx: Context, render: _RenderFunction) => {
    // assign layout data only at start of render chain
    const data = getLayoutData(ctx.state.get("layout") as string);
    for (const key in data) {
      // route-specific data has priority over layout data
      if (!ctx.state.has(key)) ctx.state.set(key, data[key]);
    }
    return resolveComponents(ctx, await _renderPage(ctx, render));
  };

export { renderPage };
