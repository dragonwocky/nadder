import { BUILD_ID, INTERNAL_PREFIX } from "../constants.ts";

const hashAssetPath = (path: string) => {
    if (!path.startsWith("/") || path.startsWith("//")) return path;
    const url = new URL(path, `https://${INTERNAL_PREFIX}assetcache.local`),
      isHttps = url.protocol === "https:",
      isAlreadyHashed = url.searchParams.has(`${INTERNAL_PREFIX}_cache_id`);
    if (!isHttps || isAlreadyHashed) return path;
    url.searchParams.set(`${INTERNAL_PREFIX}_cache_id`, BUILD_ID);
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
