const INTERNAL_PREFIX = "__nddr",
  ASSET_CACHE_KEY = `${INTERNAL_PREFIX}_cache`,
  IS_SERVER = "Deno" in globalThis,
  IS_BROWSER = !IS_SERVER,
  // TODO(dragonwocky): get deployment id and detect if prod in-browser
  DEPLOYMENT_ID = IS_SERVER ? Deno.env.get("DENO_DEPLOYMENT_ID") : undefined,
  BUILD_ID = DEPLOYMENT_ID || `${INTERNAL_PREFIX}_unknown_build`,
  IS_PROD = !!DEPLOYMENT_ID;

export {
  ASSET_CACHE_KEY,
  BUILD_ID,
  INTERNAL_PREFIX,
  IS_BROWSER,
  IS_PROD,
  IS_SERVER,
};
