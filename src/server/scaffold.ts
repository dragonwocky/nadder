import { dirname } from "https://deno.land/std@0.152.0/path/mod.ts";
import {
  extract as extractFrontmatter,
  test as hasFrontmatter,
} from "https://deno.land/std@0.151.0/encoding/front_matter.ts";

import { walkDirectory } from "./reader.ts";
import {
  Context,
  Manifest,
  Plugin,
  Route,
  RouteFile,
  StaticFile,
} from "../types.ts";

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

const ROUTE_HANDLER_KEYS = [
    "*",
    "GET",
    "HEAD",
    "POST",
    "PUT",
    "DELETE",
    "CONNECT",
    "OPTIONS",
    "TRACE",
    "PATCH",
    "default",
    "pattern",
  ],
  indexRouteFiles = async (manifest: Manifest) => {
    const textDecoder = new TextDecoder("utf-8"),
      routesDirectory = new URL("./routes", manifest.baseUrl),
      routeFiles = (await walkDirectory(routesDirectory)).map((file) => {
        const content = textDecoder.decode(file.raw),
          pathname = file.location.pathname
            .substring(dirname(manifest.baseUrl).length);
        return { ...file, content, pathname } as RouteFile;
      });
    return routeFiles;
  },
  processRoute = async (ctx: Context, route?: Route) => {
    const routeFileBasename = ctx.file.location.pathname.split("/").at(-1)!,
      pluginsTargetingRoute = getPluginsSortedBySpecificity(routeFileBasename),
      renderEngine = pluginsTargetingRoute.find((p) => "routeRenderer" in p);
    if (!renderEngine) return undefined;
    // process frontmatter
    let body: unknown = ctx.file.content;
    if (route) {
      for (const k of Object.keys(route)) {
        if (ROUTE_HANDLER_KEYS.includes(k)) continue;
        ctx.state.set(k, route[k]);
      }
      body = route.default?.(ctx);
    } else if (hasFrontmatter(ctx.file.content)) {
      const { body: _body, attrs } = //
        extractFrontmatter<Record<string, unknown>>(ctx.file.content);
      for (const k of Object.keys(attrs)) ctx.state.set(k, attrs[k]);
      body = _body;
    }
    // apply plugins
    for (const plugin of pluginCache) {
      if (!("routePreprocessor" in plugin)) continue;
      body = await plugin.routePreprocessor!(body, ctx);
    }
    body = await renderEngine.routeRenderer!(body, ctx);
    for (const plugin of pluginCache) {
      if (!("routePostprocessor" in plugin)) continue;
      body = await plugin.routePostprocessor!(body as string, ctx);
    }
    return body;
  };

export {
  indexRouteFiles,
  indexStaticFiles,
  processRoute,
  processStaticFiles,
  registerPlugin,
  unregisterPlugin,
};
