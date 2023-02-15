import {
  dirname,
  extname,
  fromFileUrl,
  join,
  toFileUrl,
} from "std/path/mod.ts";
import { walk } from "std/fs/walk.ts";
import { type Manifest } from "./server/types.ts";

const collectRoutes = async (directory: URL) => {
  const routes = [],
    entries = walk(directory, {
      includeFiles: true,
      includeDirs: false,
      followSymlinks: false,
    });
  for await (const { path } of entries) {
    const pathname = path.slice(directory.pathname.length);
    if (!/\.(t|j)sx?$/.test(pathname)) continue;
    routes.push(pathname);
  }
  return routes;
};

const generateManifest = (routes: string[]) => {
  const imports = routes
      .map((route, i) => `import * as $${i} from "./routes${route}";`),
    references = routes
      .map((route, i) => `    "${route}": $${i},`);
  return `// DO NOT EDIT. This file is automatically updated by nadder during
// development when running \`dev.ts\`. This file should be checked
// into version control and production environments.
  
${imports.join("\n")}

const manifest = {
  routes: {
${references.join("\n")}
  },
  importRoot: import.meta.url,
};

export default manifest;
`;
};

const dev = async (importRoot: Manifest["importRoot"], entrypoint: string) => {
  const routes = await collectRoutes(new URL("./routes", importRoot)),
    manifest = generateManifest(routes);
  await Deno.writeTextFile(new URL("./manifest.gen.ts", importRoot), manifest);
  import(new URL(entrypoint, importRoot).href);
};

export { dev };
