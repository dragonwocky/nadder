/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

import type { Context, Session } from "../../types.ts";
import { getCookies, setCookie } from "../../deps.ts";

const validSession = (uuid: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(uuid)
      ? uuid
      : null,
  extractSession = (ctx: Context, cookie: string) => {
    const headers = ctx.res?.headers,
      id = validSession(
        ctx.req.cookies[cookie] ??
          (headers ? getCookies(headers)[cookie] : ""),
      );
    return id;
  };

const memorySession = ({
  cookie = "session_id",
  expiry = 3600,
} = {}): Session => {
  const sessions = new Map(),
    expiries = new Map();

  const sessionExists = (id: string) => sessions.has(id),
    uniqueSession = (): string => {
      const id = crypto.randomUUID();
      return sessionExists(id) ? uniqueSession() : id;
    },
    collectGarbage = () => {
      const now = Date.now();
      for (const [id, expiry] of expiries) {
        if (now < expiry) continue;
        expiries.delete(id);
        sessions.delete(id);
      }
    };

  const set = (id: string, key: string, value: unknown) => {
      sessions.get(id)[key] = value;
    },
    get = (id: string, key: string) => sessions.get(id)[key],
    init = (ctx: Context) => {
      collectGarbage();
      const id = extractSession(ctx, cookie) ?? uniqueSession();
      if (!sessionExists(id)) {
        expiries.set(id, Date.now() + 1000 * expiry);
        sessions.set(id, {});
      }
      setCookie(ctx.res.headers, {
        name: cookie,
        value: id,
        httpOnly: true,
        maxAge: expiry,
      });
      return id;
    };

  return {
    get: (ctx, key) => {
      collectGarbage();
      const id = extractSession(ctx, cookie);
      return id ? get(id, key) : undefined;
    },
    set: (ctx, key, value) => set(init(ctx), key, value),
  };
};

export { memorySession };
