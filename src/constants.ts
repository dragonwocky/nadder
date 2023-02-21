const INTERNAL_PREFIX = "__nddr",
  IS_BROWSER = !("Deno" in globalThis),
  DEPLOYMENT_ID = IS_BROWSER ? undefined : Deno.env.get("DENO_DEPLOYMENT_ID"),
  BUILD_ID = (globalThis as { BUILD_ID?: string }).BUILD_ID ?? DEPLOYMENT_ID ??
    `${INTERNAL_PREFIX}_${crypto.randomUUID().replace(/-/g, "")}`,
  IS_PROD = (globalThis as { _IS_PROD?: boolean })._IS_PROD ?? !!DEPLOYMENT_ID;

export { BUILD_ID, INTERNAL_PREFIX, IS_BROWSER, IS_PROD };
