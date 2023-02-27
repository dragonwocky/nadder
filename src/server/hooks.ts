import { type ErrorStatus, isErrorStatus } from "./deps.ts";
import type {
  Component,
  Context,
  Data,
  ErrorHandler,
  Filter,
  Layout,
  Middleware,
  Plugin,
  Processor,
  Promisable,
  Renderer,
  Transformer,
} from "./types.ts";

type _PatternSortable = { pattern?: URLPattern; initialisesResponse?: boolean };
const sortByPattern = <T extends _PatternSortable[]>(handlers: T) => {
  // sort by specifity: outer scope executes first
  // e.g. /admin/signin -> routes/_middleware
  // ctx.next() -> routes/admin/_middleware
  // ctx.next() -> routes/admin/signin
  const getPriority = (part: string) =>
    part.startsWith(":") ? part.endsWith("*") ? 0 : 1 : 2;
  return handlers.sort((a, b) => {
    if (a.initialisesResponse && !b.initialisesResponse) return 1;
    if (!a.initialisesResponse && b.initialisesResponse) return -1;
    const partsA = a.pattern?.pathname.split("/") ?? [],
      partsB = b.pattern?.pathname.split("/") ?? [];
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      if (partsA[i] === partsB[i]) continue;
      if (partsA[i] === undefined) return -1;
      if (partsB[i] === undefined) return 1;
      return getPriority(partsA[i]) - getPriority(partsB[i]);
    }
    return 0;
  });
};

type _Renderer = { target: string; name: Renderer["name"] };
type _Transformer = { target: string; transform: Transformer["transform"] };
type _ErrorHandler = ErrorHandler & {
  render: (ctx: Context) => Promisable<string>;
};
const _data: Data[] = [],
  _layouts: Map<Layout["name"], Layout> = new Map(),
  _components: Map<Component["name"], Component> = new Map(),
  _filters: Map<string, Filter> = new Map(),
  _renderers: Map<Renderer["name"], Renderer["render"]> = new Map(),
  _renderersByExtension: _Renderer[] = [],
  _processors: Processor[] = [],
  _transformers: _Transformer[] = [],
  _middleware: Middleware[] = [],
  _errorHandlers: _ErrorHandler[] = [];

const getData = (url: URL) => _data.filter((obj) => obj.pattern!.exec(url)),
  getLayout = (name: Layout["name"]) => _layouts.get(name),
  getLayoutData = (name: Layout["name"]) => {
    let data: Data = { layout: name };
    while (data.layout) {
      const layout = data.layout as string;
      delete data.layout;
      data = { ..._layouts.get(layout), ...data };
    }
    delete data.name;
    delete data.default;
    delete data.renderEngines;
    return data;
  },
  getComponents = (): Record<string, Component> => {
    return Object.fromEntries(_components);
  },
  getFilters = (): Record<string, Filter> => {
    return Object.fromEntries(_filters);
  };

const getRenderer = (name: Renderer["name"]) => _renderers.get(name),
  getRenderersByExtension = (pathname: string): Renderer["name"][] => {
    return _renderersByExtension
      .filter(({ target }) => pathname.endsWith(target) || target === "*")
      .map((engine) => engine.name);
  },
  getProcessors = () => _processors,
  getTransformers = (pathname: string) => {
    return _transformers
      .filter((transformer) => pathname.endsWith(transformer.target))
      .map((transformer) => transformer.transform);
  };

const getMiddleware = (url: URL) => {
    return _middleware.filter((mw) => mw.pattern!.exec(url));
  },
  getErrorHandler = (status: ErrorStatus, req: Request) => {
    const url = new URL(req.url);
    return _errorHandlers.find((handler) => {
      return handler.status === status && handler.pattern!.exec(url);
    })?.render;
  };

const useData = (data: Data) => {
    data.pattern ??= new URLPattern({ pathname: "/*?" });
    if (Object.keys(data).length < 2) return;
    _data.push(data);
    sortByPattern<Data[]>(_data);
  },
  useLayout = (layout: Layout) => {
    layout.render ??= layout.default;
    if (layout.name && layout.render) _layouts.set(layout.name, layout);
  },
  useComponent = (comp: Component) => {
    comp.render ??= comp.default;
    if (comp.name && comp.render) _components.set(comp.name, comp);
  },
  useFilter = (name: string, filter: Filter) => _filters.set(name, filter);

const useRenderer = ({ name, targets, render }: Renderer) => {
    _renderers.set(name, render);
    // split up targets to create sorted list of extension-associated engines
    for (const target of targets) _renderersByExtension.push({ target, name });
    _renderersByExtension.sort((a, b) => a.target.localeCompare(b.target));
  },
  useProcessor = (processor: Processor) => _processors.push(processor),
  useTransformer = ({ targets, transform }: Transformer) => {
    for (const target of targets) _transformers.push({ target, transform });
    _transformers.sort((a, b) => a.target.localeCompare(b.target));
  },
  usePlugin = (plugin: Plugin) => {
    if (plugin.renderer) useRenderer(plugin.renderer);
    if (plugin.processor) useProcessor(plugin.processor);
    if (plugin.transformer) useTransformer(plugin.transformer);
    if (plugin.filters) {
      for (const name in plugin.filters) useFilter(name, plugin.filters[name]);
    }
  };

const useMiddleware = (middleware: Middleware) => {
    if (!("default" in middleware || "handler" in middleware)) return;
    middleware.method ??= "*";
    middleware.pattern ??= new URLPattern({ pathname: "/*?" });
    _middleware.push(middleware);
    sortByPattern<Middleware[]>(_middleware);
  },
  useErrorHandler = (errorHandler: _ErrorHandler) => {
    if (!isErrorStatus(errorHandler.status!)) return;
    if (!("default" in errorHandler || "render" in errorHandler)) return;
    _errorHandlers.push(errorHandler);
    // innermost error handler takes priority ∴ reverse
    sortByPattern<ErrorHandler[]>(_errorHandlers).reverse();
  };

export {
  getComponents,
  getData,
  getErrorHandler,
  getFilters,
  getLayout,
  getLayoutData,
  getMiddleware,
  getProcessors,
  getRenderer,
  getRenderersByExtension,
  getTransformers,
  useComponent,
  useData,
  useErrorHandler,
  useFilter,
  useLayout,
  useMiddleware,
  usePlugin,
  useProcessor,
  useRenderer,
  useTransformer,
};
