import { type ErrorStatus, isErrorStatus } from "std/http/mod.ts";
import type {
  Data,
  ErrorHandler,
  FileProcessor,
  Middleware,
  RenderEngine,
  Renderer,
} from "./types.ts";

const sortByPattern = <T extends { pattern?: URLPattern }[]>(handlers: T) => {
  // sort by specifity: outer scope executes first
  // e.g. /admin/signin -> routes/_middleware
  // ctx.next() -> routes/admin/_middleware
  // ctx.next() -> routes/admin/signin
  const getPriority = (part: string) =>
    part.startsWith(":") ? part.endsWith("*") ? 0 : 1 : 2;
  return handlers.sort((a, b) => {
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

type _FileProcessor = { target: string; transform: FileProcessor["transform"] };
type _RenderEngine = { target: string; render: RenderEngine["render"] };
type _ErrorHandler = ErrorHandler & { render: Renderer<string> };
const _data: Data[] = [],
  _errorHandlers: _ErrorHandler[] = [],
  _middleware: Middleware[] = [],
  _fileProcessors: _FileProcessor[] = [],
  _renderEnginesById: Map<string, RenderEngine["render"]> = new Map(),
  _renderEnginesByExtension: _RenderEngine[] = [];

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
    return _fileProcessors
      .filter((processor) => pathname.endsWith(processor.target))
      .map((processor) => processor.transform);
  },
  getRendererById = (id: RenderEngine["id"]) => _renderEnginesById.get(id),
  getRenderersByExtension = (pathname: string): RenderEngine["render"][] => {
    return _renderEnginesByExtension
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
  useProcessor = ({ targets, transform }: FileProcessor) => {
    for (const target of targets) _fileProcessors.push({ target, transform });
    _fileProcessors.sort((a, b) => a.target.localeCompare(b.target));
  },
  useRenderer = ({ id, targets, render }: RenderEngine) => {
    _renderEnginesById.set(id, render);
    // split up targets to create sorted list of extension-associated engines
    for (const target of targets) {
      _renderEnginesByExtension.push({ target, render });
    }
    _renderEnginesByExtension.sort((a, b) => a.target.localeCompare(b.target));
  };

export {
  getData,
  getErrorHandler,
  getMiddleware,
  getProcessorsByExtension,
  getRendererById,
  getRenderersByExtension,
  useData,
  useErrorHandler,
  useMiddleware,
  useProcessor,
  useRenderer,
};
