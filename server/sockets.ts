/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

export interface SocketContext {
  req: Readonly<RequestContext>;
  socket: WebSocket;
}

type SocketHandler = (ctx: SocketContext) => void | Promise<void>;
const _ws: [URLPattern, SocketHandler][] = [];
export const ws = (route: string, handler: SocketHandler) => {
  _ws.push([new URLPattern({ pathname: route }), handler]);
};
