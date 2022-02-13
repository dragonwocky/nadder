/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

import type { Context } from "../types.ts";
import { HTTPStatus, HTTPStatusText } from "../deps.ts";

const statusResponse = (ctx: Context, status: HTTPStatus) => {
  ctx.res.body = `${status} ${HTTPStatusText.get(status) ?? ""}`;
  ctx.res.status = status;
};

export { statusResponse };
