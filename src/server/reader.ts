import { walk } from "https://deno.land/std@0.150.0/fs/mod.ts";
import { contentType } from "https://deno.land/std@0.150.0/media_types/mod.ts";
import {
  extname,
  fromFileUrl,
  toFileUrl,
} from "https://deno.land/std@0.150.0/path/mod.ts";

import { BUILD_ID } from "../constants.ts";
import { File } from "../types.ts";

const catchFileErrors = async (handler: CallableFunction) => {
  try {
    return await handler();
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      // ignore
    } else throw err;
  }
};

const generateEtag = async (path: string) => {
    const encoder = new TextEncoder(),
      uintPath = encoder.encode(BUILD_ID + path),
      hashedPath = await crypto.subtle.digest("SHA-1", uintPath);
    return Array.from(new Uint8Array(hashedPath))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  },
  getContentType = (path: string) => {
    return contentType(extname(path)) ??
      "application/octet-stream";
  },
  getFileSize = async (path: URL) => {
    return (await Deno.stat(path)).size;
  };

const readCache: Map<string, Readonly<File>> = new Map(),
  readFile = async (location: URL): Promise<File> => {
    // files are cached to reduce repeated file reads
    if (!readCache.has(location.href)) {
      readCache.set(location.href, {
        location,
        type: getContentType(location.href),
        etag: await generateEtag(location.href),
        size: await getFileSize(location),
        content: await Deno.readFile(location),
      });
    }
    // returns a clone to keep cache immutable
    return { ...structuredClone(readCache.get(location.href)!), location };
  },
  walkDirectory = (location: URL): Promise<File[]> => {
    return catchFileErrors(async () => {
      const files: Promise<File>[] = [],
        entries = walk(fromFileUrl(location), {
          includeFiles: true,
          includeDirs: false,
          followSymlinks: false,
        });
      for await (const { path } of entries) {
        files.push(catchFileErrors(async () => {
          return await readFile(toFileUrl(path));
        }));
      }
      return Promise.all(files);
    });
  };

export { generateEtag, getContentType, getFileSize, readFile, walkDirectory };
