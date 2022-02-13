/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

import type { Callback, Context } from "../types.ts";

const middleware: Callback[] = [];

const useMiddleware = (callback: Callback) => middleware.push(callback);

const callMiddleware = async (ctx: Context) => {
  for (const callback of middleware) await callback(ctx);
};

export { callMiddleware, useMiddleware };
