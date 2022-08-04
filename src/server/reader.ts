import { walk } from "std/fs/mod.ts";
import { contentType } from "std/media_types/mod.ts";
import { extname, fromFileUrl, toFileUrl } from "std/path/mod.ts";

import { BUILD_ID } from "../constants.ts";
import { File, Manifest, StaticFile } from "../types.ts";

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

const readCache: Map<string, File> = new Map(),
  readFile = async (path: string | URL): Promise<File> => {
    if (!(path instanceof URL)) path = toFileUrl(path);
    // files are cached to reduce repeated file reads
    if (!readCache.has(path.href)) {
      readCache.set(path.href, {
        absolutePath: path,
        sizeInBytes: await getFileSize(path),
        cachedContent: await Deno.readFile(path),
      });
    }
    // returns a clone to prevent cache modification
    return structuredClone(readCache.get(path.href)!);
  },
  walkDirectory = async (
    directory: string | URL,
    baseUrl?: string,
  ): Promise<Required<File>[]> => {
    if (!(directory instanceof URL)) directory = new URL(directory, baseUrl);
    const files: Required<File>[] = [];
    try {
      const entries = walk(fromFileUrl(directory), {
        includeFiles: true,
        includeDirs: false,
        followSymlinks: false,
      });
      for await (const entry of entries) {
        const filePath = toFileUrl(entry.path),
          relativePath = filePath.href.substring(directory.href.length);
        files.push({ relativePath, ...(await readFile(filePath)) });
      }
    } catch (err) {
      if (err instanceof Deno.errors.NotFound) {
        // ignore
      } else throw err;
    }
    return files;
  };

const indexStaticFiles = async (manifest: Manifest): Promise<StaticFile[]> => {
  const staticFiles = (await walkDirectory("./static", manifest.baseUrl));
  return Promise.all(staticFiles.map(async (file) => ({
    ...file,
    contentType: getContentType(file.relativePath),
    ETag: await generateEtag(file.relativePath),
  }))) as Promise<StaticFile[]>;
};

const indexRouteFiles = async (manifest: Manifest) => {
  const routeFiles = (await walkDirectory("./routes", manifest.baseUrl));
};

export { generateEtag, getContentType, getFileSize, readFile, walkDirectory };
