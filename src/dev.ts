import {
  dirname,
  extname,
  fromFileUrl,
  join,
  toFileUrl,
} from "std/path/mod.ts";
import { walk } from "std/fs/walk.ts";

import { Manifest } from "./types.ts";

const collectProjectRoutes = (directory: string) => {
};

const generateManifestFromRoutes = () => {
  },
  writeManifestToFilesystem = () => {};

const dev = (root: string, entrypoint: string) => {
  // ...
  import(entrypoint);
};

export { dev };
