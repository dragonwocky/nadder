import { walk } from "std/fs/mod.ts";
import { contentType } from "std/media_types/mod.ts";
import { extname, toFileUrl } from "std/path/mod.ts";
import { BUILD_ID } from "../constants.ts";
import type { File } from "./types.ts";

const catchErrors = async (handler: CallableFunction) => {
  try {
    return await handler();
  } catch (err) {
    if (!(err instanceof Deno.errors.NotFound)) throw err;
  }
};

const _cache: Map<string, Readonly<Omit<File, "location">>> = new Map(),
  readFile = async (location: URL, pathnameTrim: number): Promise<File> => {
    // files are cached to reduce repeated file reads
    if (!_cache.has(location.href)) {
      const uid = new TextEncoder().encode(BUILD_ID + location.href);
      _cache.set(location.href, {
        pathname: location.pathname.slice(pathnameTrim),
        type: contentType(extname(location.href)) ?? "application/octet-stream",
        size: (await Deno.stat(location)).size,
        content: await Deno.readFile(location),
        etag: [...new Uint8Array(await crypto.subtle.digest("SHA-1", uid))]
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join(""),
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

export { readFile, walkDirectory };
