import { ASSET_CACHE_KEY, BUILD_ID, INTERNAL_PREFIX } from "../constants.ts";

const hashAssetPath = (path: string) => {
    if (!path.startsWith("/") || path.startsWith("//")) return path;
    const localUrlhost = `${INTERNAL_PREFIX}assetcache.local`,
      url = new URL(path, `https://${localUrlhost}`),
      isHttps = url.protocol === "https:",
      isLocalUrl = url.host === localUrlhost,
      isAlreadyHashed = url.searchParams.has(ASSET_CACHE_KEY);
    if (!isHttps || !isLocalUrl || isAlreadyHashed) return path;
    url.searchParams.set(ASSET_CACHE_KEY, BUILD_ID);
    return url.pathname + url.search + url.hash;
  },
  hashAssetSrcSet = (srcset: string) => {
    // from fresh/src/runtime/utils.ts
    // (c) 2021 Luca Casonato under the MIT license
    if (srcset.includes("(")) return srcset;
    const parts = srcset.split(","),
      constructed = [];
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed === "") return srcset;
      const leadingWhitespaceLen = part.length - trimmed.length;
      let urlEnd = trimmed.indexOf(" ");
      if (urlEnd === -1) urlEnd = trimmed.length;
      const leading = part.substring(0, leadingWhitespaceLen),
        url = trimmed.substring(0, urlEnd),
        trailing = trimmed.substring(urlEnd);
      constructed.push(leading + hashAssetPath(url) + trailing);
    }
    return constructed.join(",");
  };

export { hashAssetPath, hashAssetSrcSet };
