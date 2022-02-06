/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

import { RouteContext, SocketContext } from "./server.ts";
import { getCookies, setCookie } from "./deps.ts";

export interface Session {
  get: (
    ctx: RouteContext | SocketContext,
    key: string,
  ) => unknown | Promise<unknown>;
  set: (ctx: RouteContext, key: string, value: unknown) => void | Promise<void>;
}

const validSession = (uuid: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(uuid)
      ? uuid
      : null,
  extractSession = (ctx: RouteContext | SocketContext, cookie: string) => {
    const headers = (<RouteContext> ctx).res?.headers,
      id = validSession(
        ctx.req.cookies[cookie] ??
          (headers ? getCookies(headers)[cookie] : ""),
      );
    return id;
  };

export const memorySession = ({
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
    init = (ctx: RouteContext) => {
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

export const postgresSession = async (query: CallableFunction, {
  cookie = "session_id",
  expiry = 3600,
  table = "sessions",
} = {}): Promise<Session> => {
  await query(`
    CREATE TABLE IF NOT EXISTS ${table} (
      id UUID PRIMARY KEY,
      expiry TIMESTAMP NOT NULL,
      state JSONB NOT NULL
    )
  `);

  const sessionExists = async (id: string) => {
      const q = `SELECT EXISTS(SELECT 1 FROM ${table} where id = $id)`,
        // deno-lint-ignore no-explicit-any
        res: any = await query(q, { id });
      return res.rows?.[0]?.exists;
    },
    uniqueSession = async (): Promise<string> => {
      const id = crypto.randomUUID();
      return await sessionExists(id) ? uniqueSession() : id;
    },
    collectGarbage = () => query(`DELETE FROM ${table} WHERE expiry < NOW()`);

  const set = async (id: string, key: string, value: unknown) => {
      const q = `UPDATE ${table} SET state = state || $state WHERE ID = $id`;
      await query(q, { id, state: JSON.stringify({ [key]: value }) });
    },
    get = async (id: string, key: string) => {
      const q = `SELECT state::json->$key FROM ${table} WHERE id = $id`,
        // deno-lint-ignore no-explicit-any
        res: any = await query(q, { id, key });
      return res.rows?.[0]?.["?column?"];
    },
    init = async (ctx: RouteContext) => {
      await collectGarbage();
      const id = extractSession(ctx, cookie) ?? await uniqueSession();
      if (!(await sessionExists(id))) {
        const timestamp = (new Date(Date.now() + 1000 * expiry)).toISOString(),
          q = `
            INSERT INTO ${table} (id, expiry, state)
            VALUES ($id, $expiry, $state)
          `;
        await query(q, { id, expiry: timestamp, state: {} });
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
    get: async (ctx, key) => {
      await collectGarbage();
      const id = extractSession(ctx, cookie);
      return id ? await get(id, key) : undefined;
    },
    set: async (ctx, key, value) => set(await init(ctx), key, value),
  };
};
