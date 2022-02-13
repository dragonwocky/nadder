/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

// https://www.iana.org/assignments/http-methods/http-methods.xhtml
type RequestMethod =
  | "ACL"
  | "BASELINE-CONTROL"
  | "BIND"
  | "CHECKIN"
  | "CHECKOUT"
  | "CONNECT"
  | "COPY"
  | "DELETE"
  | "GET"
  | "HEAD"
  | "LABEL"
  | "LINK"
  | "LOCK"
  | "MERGE"
  | "MKACTIVITY"
  | "MKCALENDAR"
  | "MKCOL"
  | "MKREDIRECTREF"
  | "MKWORKSPACE"
  | "MOVE"
  | "OPTIONS"
  | "ORDERPATCH"
  | "PATCH"
  | "POST"
  | "PRI"
  | "PROPFIND"
  | "PROPPATCH"
  | "PUT"
  | "REBIND"
  | "REPORT"
  | "SEARCH"
  | "TRACE"
  | "UNBIND"
  | "UNCHECKOUT"
  | "UNLINK"
  | "UNLOCK"
  | "UPDATE"
  | "UPDATEREDIRECTREF"
  | "VERSION-CONTROL";

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

type Callback = (ctx: Context) => void | Promise<void>;

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
    readonly sent: boolean;
  };
  upgrade: {
    readonly available: boolean;
    readonly socket: () => WebSocket | undefined;
    channel: string;
  };
}

interface Session {
  get: (ctx: Context, key: string) => unknown | Promise<unknown>;
  set: (ctx: Context, key: string, value: unknown) => void | Promise<void>;
}

export type { Callback, Context, Mutable, RequestBody, RequestMethod, Session };
