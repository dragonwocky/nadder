/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

import type { Context } from "../types.ts";

const router = {
  get: () => {},
  post: () => {},
  patch: () => {},
  put: () => {},
  delete: () => {},
  socket: () => {},
};

export { router };
// const _routes: { [k in HTTPMethod]?: [URLPattern, RouteHandler][] } = {};
// export const route = (
//   method: HTTPMethod,
//   route: string,
//   handler: RouteHandler,
// ) => {
//   if (!_routes[method]) _routes[method] = [];
//   _routes[method]!.push([new URLPattern({ pathname: route }), handler]);
// };
