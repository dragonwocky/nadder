/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

import { listenAndServe } from "./server/listener.ts";
import { useMiddleware } from "./server/middleware.ts";
import { handleRoute } from "./server/router.ts";
export default { listenAndServe, useMiddleware, handleRoute };

export { contentType } from "./deps.ts";
export { HTTPStatus, HTTPStatusText } from "./deps.ts";
export { deleteCookie, setCookie } from "./deps.ts";

export { fileResponse } from "./responses/file.ts";
export { htmlResponse } from "./responses/html.ts";
export { jsonResponse } from "./responses/json.ts";
export { statusResponse } from "./responses/status.ts";
export { markResponseForDownload } from "./responses/download.ts";

export { postgresConnection } from "./storage/drivers/postgres.ts";
export { memorySession } from "./storage/sessions/memory.ts";
export { postgresSession } from "./storage/sessions/postgres.ts";

export { h, jsxFrag, jsxToString } from "./engines/html/jsx.ts";
export { unoInstance } from "./engines/css/uno.ts";

// middleware

export type { Context, Session } from "./types.ts";
export type { Cookie } from "./deps.ts";
