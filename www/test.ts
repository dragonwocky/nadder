import { type Manifest } from "../src/types.ts";
import { indexStaticFiles, processStaticFiles } from "../src/server.ts";

const manifest: Manifest = {
  routes: {},
  baseUrl: import.meta.url,
};

const staticFiles = await processStaticFiles(await indexStaticFiles(manifest));

console.log(staticFiles);
