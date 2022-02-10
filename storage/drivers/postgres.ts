/**
 * nadder
 * (c) 2022 dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/)
 * (https://github.com/dragonwocky/nadder) under the MIT license
 */

import { postgres } from "../../deps.ts";

const postgresConnection = ({
  user = "postgres",
  password = Deno.env.get("POSTGRES_PWD"),
  hostname = Deno.env.get("POSTGRES_HOST"),
  port = "6543",
  database = "postgres",
} = {}) => {
  // creates lazy/on-demand connections
  // for concurrent query execution handling
  // = more performant and reusable than a normal client
  const config = { user, password, hostname, port, database },
    pool = new postgres.Pool(config, 3, true),
    query = async (...args: unknown[]): Promise<unknown | Error> => {
      const connection = await pool.connect();
      try {
        // @ts-ignore pass all args
        const res = await connection.queryObject(...args);
        return res;
      } catch (err) {
        console.error(err);
        return err;
      } finally {
        // returns connection to the pool for reuse
        connection.release();
      }
    };
  return query;
};

export { postgresConnection };
