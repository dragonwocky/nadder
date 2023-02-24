import { walk } from "./server/deps.ts";
import { type Manifest } from "./server/types.ts";

const collectImports = async (directory: URL) => {
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

const generateManifest = (scripts: string[]) => {
  let routes = "", layouts = "", components = "", imports = "";
  for (let i = 0; i < scripts.length; i++) {
    imports += `\nimport * as $${i} from "./routes${scripts[i]}";`;
    if (/^\/_layouts/.test(scripts[i])) {
      layouts += `\n    "${scripts[i].slice(9)}": $${i},`;
    } else if (/^\/_components/.test(scripts[i])) {
      components += `\n    "${scripts[i].slice(12)}": $${i},`;
    } else routes += `\n    "${scripts[i]}": $${i},`;
  }

  return `// DO NOT EDIT. This file is automatically updated by nadder during
// development when running \`dev.ts\`. This file should be checked
// into version control and production environments.
${imports}

const manifest = {
  routes: {${routes}${routes.length ? "\n  " : ""}},
  layouts: {${layouts}${layouts.length ? "\n  " : ""}},
  components: {${components}${components.length ? "\n  " : ""}},
  importRoot: import.meta.url,
};

export default manifest;
`;
};

const dev = async (importRoot: Manifest["importRoot"], entrypoint: string) => {
  const scripts = await collectImports(new URL("./routes", importRoot)),
    manifest = generateManifest(scripts);
  await Deno.writeTextFile(new URL("./manifest.gen.ts", importRoot), manifest);
  import(new URL(entrypoint, importRoot).href);
};

export { dev };
