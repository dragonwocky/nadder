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

const postgresSession = async (query: CallableFunction, {
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
    init = async (ctx: Context) => {
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

export { postgresSession };
