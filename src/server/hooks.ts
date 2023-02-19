import { type ErrorStatus, isErrorStatus } from "std/http/mod.ts";
import type {
  _RenderFunction,
  Data,
  ErrorHandler,
  Middleware,
  Processor,
  Renderer,
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

type _Processor = { target: string; transform: Processor["transform"] };
type _Renderer = { target: string; render: Renderer["render"] };
type _ErrorHandler = ErrorHandler & { render: _RenderFunction<string> };
const _data: Data[] = [],
  _errorHandlers: _ErrorHandler[] = [],
  _middleware: Middleware[] = [],
  _processors: _Processor[] = [],
  _renderersByName: Map<string, Renderer["render"]> = new Map(),
  _renderersByExtension: _Renderer[] = [];

const getData = (url: URL) => _data.filter((obj) => obj.pattern!.exec(url)),
  getErrorHandler = (status: ErrorStatus, req: Request) => {
    const url = new URL(req.url);
    return _errorHandlers.find((handler) => {
      return handler.status === status && handler.pattern!.exec(url);
    })?.render;
  },
  getMiddleware = (url: URL) => {
    return _middleware.filter((mw) => mw.pattern!.exec(url));
  },
  getProcessorsByExtension = (pathname: string) => {
    return _processors
      .filter((processor) => pathname.endsWith(processor.target))
      .map((processor) => processor.transform);
  },
  getRendererByName = (name: Renderer["name"]) => _renderersByName.get(name),
  getRenderersByExtension = (pathname: string): Renderer["render"][] => {
    return _renderersByExtension
      .filter((engine) => pathname.endsWith(engine.target))
      .map((engine) => engine.render);
  };

const useData = (data: Data) => {
    data.pattern ??= new URLPattern({ pathname: "/*?" });
    if (Object.keys(data).length < 2) return;
    _data.push(data);
    sortByPattern<Data[]>(_data);
  },
  useErrorHandler = (errorHandler: _ErrorHandler) => {
    if (!isErrorStatus(errorHandler.status!)) return;
    if (!("default" in errorHandler || "handler" in errorHandler)) return;
    _errorHandlers.push(errorHandler);
    // innermost error handler takes priority ∴ reverse
    sortByPattern<ErrorHandler[]>(_errorHandlers).reverse();
  },
  useMiddleware = (middleware: Middleware) => {
    if (!("default" in middleware || "handler" in middleware)) return;
    _middleware.push({
      method: "*",
      pattern: new URLPattern({ pathname: "/*?" }),
      ...middleware,
    });
    sortByPattern<Middleware[]>(_middleware);
  },
  useProcessor = ({ targets, transform }: Processor) => {
    for (const target of targets) _processors.push({ target, transform });
    _processors.sort((a, b) => a.target.localeCompare(b.target));
  },
  useRenderer = ({ name, targets, render }: Renderer) => {
    _renderersByName.set(name, render);
    // split up targets to create sorted list of extension-associated engines
    for (const target of targets) {
      _renderersByExtension.push({ target, render });
    }
    _renderersByExtension.sort((a, b) => a.target.localeCompare(b.target));
  };

export {
  getData,
  getErrorHandler,
  getMiddleware,
  getProcessorsByExtension,
  getRendererByName,
  getRenderersByExtension,
  useData,
  useErrorHandler,
  useMiddleware,
  useProcessor,
  useRenderer,
};
