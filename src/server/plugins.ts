import type { Plugin } from "./types.ts";

const pluginCache: Set<Plugin> = new Set(),
  registerPlugin = (plugin: Plugin) => pluginCache.add(plugin),
  unregisterPlugin = (plugin: Plugin) => pluginCache.delete(plugin);

const getPluginsInRegistrationOrder = () => [...pluginCache],
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

export {
  getPluginsInRegistrationOrder,
  getPluginsSortedBySpecificity,
  registerPlugin,
  unregisterPlugin,
};
