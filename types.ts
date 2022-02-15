/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

import { HTTPStatus } from "./deps.ts";

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

// full list: https://www.iana.org/assignments/http-methods/http-methods.xhtml
const RequestMethods = [
  "POST", // Create
  "GET", // Read
  "PUT", // Replace
  "PATCH", // Update
  "DELETE", // Delete
  "*",
] as const;
type RequestMethod = typeof RequestMethods[number];

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
    sendStatus: (status: HTTPStatus) => void;
    sendJSON: (data: unknown) => void;
    sendFile: (filepath: string) => Promise<void>;
    sendFileStream: (filepath: string) => Promise<void>;
    inferContentType: (lookup: string) => void;
    markForDownload: (filename?: string) => void;
  };
  upgrade: {
    readonly available: boolean;
    readonly socket: () => WebSocket | undefined;
    channel: {
      readonly name: string;
      join: (name: string) => void;
      broadcast: (message: unknown) => void;
    };
  };
}

interface Session {
  get: (ctx: Context, key: string) => unknown | Promise<unknown>;
  set: (ctx: Context, key: string, value: unknown) => void | Promise<void>;
}

export type { Callback, Context, Mutable, RequestBody, RequestMethod, Session };
export { RequestMethods };
