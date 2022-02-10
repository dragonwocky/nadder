/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

type Mutable<T> = { -readonly [P in keyof T]: Mutable<T[P]> };

type RequestMethod =
  | "GET"
  | "HEAD"
  | "POST"
  | "PATCH"
  | "PUT"
  | "DELETE"
  | "SOCKET";

type RequestBody =
  | string
  | number
  | boolean
  | Record<string, unknown>
  | unknown[]
  | null
  | undefined
  | FormData
  | Blob
  | ArrayBuffer;

interface Context {
  readonly req: {
    method: RequestMethod;
    ip: string | null;
    url: URL;
    body: RequestBody;
    queryParams: URLSearchParams;
    pathParams: Record<string, unknown>;
    cookies: Record<string, string>;
    headers: Headers;
  };
  res: {
    body: BodyInit;
    status: number;
    headers: Headers;
  };
  upgrade: {
    socket: WebSocket | undefined;
    channel: string;
  };
}

interface Session {
  get: (ctx: Context, key: string) => unknown | Promise<unknown>;
  set: (ctx: Context, key: string, value: unknown) => void | Promise<void>;
}

export type { Context, Session };
