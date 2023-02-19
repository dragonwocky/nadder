import {
  getComponents,
  getLayout,
  getLayoutData,
  getRenderer,
} from "./hooks.ts";
import { type _RenderFunction, type Context } from "./types.ts";

const _renderPage = async (ctx: Context, render: _RenderFunction) => {
    let content = await render?.(ctx, getComponents()) ?? "";
    const engines = (ctx.state.get("renderEngines") as string[] ?? [])
      .map(getRenderer).filter((engine) => engine);
    for (const engine of engines) content = await engine!(content, ctx);
    const layout = getLayout(ctx.state.get("layout") as string);
    if (layout) {
      ctx.state.set("content", content);
      ctx.state.set("layout", layout.layout);
      ctx.state.set("renderEngines", layout.renderEngines);
      const render = layout.render as _RenderFunction<unknown>;
      content = await _renderPage(ctx, render);
    }
    return String(content);
  },
  renderPage = (ctx: Context, render: _RenderFunction) => {
    // assign layout data only at start of render chain
    const layoutName = ctx.state.get("layout") as string,
      layoutData = getLayoutData(layoutName);
    for (const key in layoutData) {
      // route-specific data has priority over layout data
      if (!ctx.state.has(key)) ctx.state.set(key, layoutData[key]);
    }
    return _renderPage(ctx, render);
  };

const renderComponent = () => {
  //
};

export { renderComponent, renderPage };
