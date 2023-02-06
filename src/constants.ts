let { BUILD_ID, IS_PROD } = globalThis as {
  BUILD_ID?: string;
  IS_PROD?: boolean;
};

const INTERNAL_PREFIX = "__nddr",
  IS_BROWSER = !("Deno" in globalThis),
  DEPLOYMENT_ID = IS_BROWSER ? undefined : Deno.env.get("DENO_DEPLOYMENT_ID");
BUILD_ID ??= DEPLOYMENT_ID;
BUILD_ID ??= `${INTERNAL_PREFIX}_${crypto.randomUUID().replace(/-/g, "")}`;
IS_PROD ??= !!DEPLOYMENT_ID;

export { BUILD_ID, INTERNAL_PREFIX, IS_BROWSER, IS_PROD };
