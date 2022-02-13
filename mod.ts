/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

import { listenAndServe } from "./server/listener.ts";
import { useMiddleware } from "./server/middleware.ts";
import { handleRoute } from "./server/router.ts";
export default { listenAndServe, useMiddleware, handleRoute };

export {
  fileResponse,
  htmlResponse,
  jsonResponse,
  markResponseForDownload,
  statusResponse,
} from "./server/response.ts";

export { contentType } from "./deps.ts";
export { HTTPStatus, HTTPStatusText } from "./deps.ts";
export { deleteCookie, setCookie } from "./deps.ts";

export { postgresConnection } from "./storage/drivers/postgres.ts";
export { memorySession } from "./storage/sessions/memory.ts";
export { postgresSession } from "./storage/sessions/postgres.ts";

export { h, jsxFrag, jsxToString } from "./ssr/jsx.ts";
export { unoInstance } from "./ssr/uno.ts";
export { md } from "./ssr/md.ts";

export type { Context, Session } from "./types.ts";
export type { Cookie } from "./deps.ts";
