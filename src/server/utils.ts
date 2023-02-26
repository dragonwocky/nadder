import { BUILD_ID } from "../constants.ts";
import {
  contentType,
  extname,
  Status,
  STATUS_TEXT,
  toFileUrl,
  toHashString,
  walk,
} from "./deps.ts";
import type { File } from "./types.ts";

const catchErrors = async (handler: CallableFunction) => {
  try {
    return await handler();
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }
};

const createEtag = async (pathname: string) => {
    const payload = new TextEncoder().encode(`${pathname}@${BUILD_ID}`);
    return toHashString(await crypto.subtle.digest("SHA-1", payload));
  },
  createResponse = (
    body: BodyInit | null | undefined,
    init: ResponseInit & { status?: Status; "content-type"?: string },
  ) => {
    const res = new Response(body, {
      status: init.status ?? Status.OK,
      statusText: STATUS_TEXT[init.status ?? Status.OK],
      ...init,
    });
    if (init["content-type"]) {
      const type = contentType(init["content-type"]) ?? init["content-type"];
      res.headers.set("content-type", type);
    }
    return res;
  };

const pathToPattern = (path: string): URLPattern => {
  return new URLPattern({
    pathname: path.split("/")
      .map((part) => {
        if (part.endsWith("]")) {
          // repeated group e.g. /[...path] matches /path/to/file/
          if (part.startsWith("[...")) return `:${part.slice(4, -1)}*`;
          // named group e.g. /user/[id] matches /user/6448
          if (part.startsWith("[")) `:${part.slice(1, -1)}`;
        }
        return part;
      }).join("/")
      // /route/index is equiv to -> /route
      .replace(/\/index$/, "")
      // /*? matches all nested routes
      .replace(/\/_(middleware|data|\d\d\d)$/, "/*?")
      // ensure starting slash and remove repeat slashes
      .replace(/(^\/*|\/+)/g, "/"),
  });
};

const _cache: Map<string, Readonly<Omit<File, "location">>> = new Map(),
  readFile = async (location: URL, pathnameTrim: number): Promise<File> => {
    // files are cached to reduce repeated file reads
    if (!_cache.has(location.href)) {
      const stat = await Deno.stat(location),
        pathname = location.pathname.slice(pathnameTrim);
      _cache.set(location.href, {
        pathname,
        type: contentType(extname(location.href)) ?? "application/octet-stream",
        mtime: stat.mtime,
        size: stat.size,
        content: await Deno.readFile(location),
        etag: await createEtag(pathname),
      });
    }
    // returns a clone to keep cache immutable
    return { ...structuredClone(_cache.get(location.href)!), location };
  },
  walkDirectory = (location: URL): Promise<File[]> => {
    return catchErrors(async () => {
      const files: Promise<File>[] = [],
        entries = walk(location, {
          includeFiles: true,
          includeDirs: false,
          followSymlinks: false,
        });
      for await (const { path } of entries) {
        files.push(catchErrors(async () => {
          return await readFile(toFileUrl(path), location.pathname.length);
        }));
      }
      return Promise.all(files);
    });
  };

export { createResponse, pathToPattern, walkDirectory };
