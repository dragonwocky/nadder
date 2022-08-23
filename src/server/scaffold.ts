import { dirname } from "https://deno.land/std@0.150.0/path/mod.ts";

import { walkDirectory } from "./reader.ts";
import { Context, Manifest, Plugin, Route, StaticFile } from "../types.ts";

const pluginCache: Set<Plugin> = new Set(),
  registerPlugin = (plugin: Plugin) => pluginCache.add(plugin),
  unregisterPlugin = (plugin: Plugin) => pluginCache.delete(plugin),
  getPluginsSortedBySpecificity = (basenameToMatch: string) => {
    const matchingExtsCache: Map<Plugin, string[]> = new Map(),
      doesExtTargetBasename = (ext: string) => {
        return ext === "*" || basenameToMatch.endsWith(ext);
      };
    return [...pluginCache]
      .filter((p) => {
        const matchingFileExtensions = p.targetFileExtensions
            ?.filter(doesExtTargetBasename)
            .sort((a, b) => {
              if (a === "*") return 1;
              if (b === "*") return -1;
              return a.length - b.length;
            }) || [],
          pluginTargetsBasename = matchingFileExtensions.length;
        matchingExtsCache.set(p, matchingFileExtensions);
        return pluginTargetsBasename;
      })
      .sort((a, b) => {
        const matchingExtsA = matchingExtsCache.get(a)!,
          matchingExtsB = matchingExtsCache.get(b)!;
        return matchingExtsA[0].length -
          matchingExtsB[0].length;
      });
  };

const indexStaticFiles = async (manifest: Manifest): Promise<StaticFile[]> => {
    const staticDirectory = new URL("./static", manifest.baseUrl),
      staticFiles = (await walkDirectory(staticDirectory)).map((file) => {
        const pathname = file.location.pathname
          .substring(dirname(manifest.baseUrl).length);
        return { ...file, pathname } as StaticFile;
      });
    return staticFiles;
  },
  processStaticFiles = async (staticFiles: StaticFile[]) => {
    for (const plugin of pluginCache) {
      if (!("staticFileProcessor" in plugin)) continue;
      staticFiles = await Promise.all(staticFiles.map((file) => {
        return plugin.staticFileProcessor!(file);
      }));
    }
    return staticFiles;
  };

const indexRouteFiles = async (manifest: Manifest) => {
    const routesDirectory = new URL("./routes", manifest.baseUrl),
      routeFiles = (await walkDirectory(routesDirectory)).map((file) => {
        const pathname = file.location.pathname
          .substring(dirname(manifest.baseUrl).length);
        return { ...file, pathname };
      });
  },
  processRoute = async (ctx: Context, route?: Route) => {
    const routeFileBasename = ctx.file.location.pathname.split("/").at(-1)!,
      pluginsTargetingRoute = getPluginsSortedBySpecificity(routeFileBasename),
      renderEngine = pluginsTargetingRoute.find((p) => "routeRenderer" in p);
    if (!renderEngine) return undefined;
    let data = route?.default?.(ctx) ?? ctx.file.content;
    data = await renderEngine.routeRenderer!(data, ctx);
    for (const plugin of pluginCache) {
      if (!("routePostprocessor" in plugin)) continue;
      data = await plugin.routePostprocessor!(data as string, ctx);
    }
    return data;
    // processFileFrontmatter
  };

export {
  indexRouteFiles,
  indexStaticFiles,
  processRoute,
  processStaticFiles,
  registerPlugin,
  unregisterPlugin,
};
