/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

import type { Callback, RequestMethod } from "../types.ts";

const routes: { [k in RequestMethod]?: [URLPattern, Callback][] } = {};

const getRoute = (method: RequestMethod, href: string) => {
  const route = routes[method]?.find?.(([pattern, _]) => pattern.test(href));
  if (!route) return undefined;
  return {
    callback: route[1],
    pathParams: route[0].exec(href)?.pathname?.groups ?? {},
  };
};

const handleRoute = (
  method: RequestMethod,
  path: string,
  callback: Callback,
) => {
  if (!routes[method]) routes[method] = [];
  routes[method]!.push([new URLPattern({ pathname: path }), callback]);
};

export { getRoute, handleRoute };
