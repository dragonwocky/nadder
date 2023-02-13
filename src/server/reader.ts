import { BUILD_ID } from "nadder/constants.ts";
import type { File } from "nadder/types.ts";

import { contentType as _contentType } from "std/media_types/mod.ts";
import { extname, toFileUrl } from "std/path/mod.ts";
import { walk } from "std/fs/mod.ts";

const contentType = (path: string) => _contentType(extname(path)),
  generateEtag = async (path: string) => {
    const encoder = new TextEncoder(),
      uintId = encoder.encode(BUILD_ID + path),
      hashedId = await crypto.subtle.digest("SHA-1", uintId);
    return Array.from(new Uint8Array(hashedId))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  };

const readCache: Map<string, Readonly<Omit<File, "location">>> = new Map(),
  readFile = async (location: URL, baseUrl: URL): Promise<File> => {
    // files are cached to reduce repeated file reads
    if (!readCache.has(location.href)) {
      readCache.set(location.href, {
        pathname: location.pathname.slice(baseUrl.pathname.length),
        type: contentType(location.href) ?? "application/octet-stream",
        etag: await generateEtag(location.href),
        size: (await Deno.stat(location)).size,
        content: await Deno.readFile(location),
      });
    }
    // returns a clone to keep cache immutable
    return { ...structuredClone(readCache.get(location.href)!), location };
  };

const catchFileErrors = async (handler: CallableFunction) => {
    try {
      return await handler();
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        console.log(err);
        // ignore
      } else throw err;
    }
  },
  walkDirectory = (location: URL): Promise<File[]> => {
    return catchFileErrors(async () => {
      const files: Promise<File>[] = [],
        entries = walk(location, {
          includeFiles: true,
          includeDirs: false,
          followSymlinks: false,
        });
      for await (const { path } of entries) {
        files.push(catchFileErrors(async () => {
          return await readFile(toFileUrl(path), location);
        }));
      }
      return Promise.all(files);
    });
  };

export { contentType, readFile, walkDirectory };
