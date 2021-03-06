import { Middleware } from "../../src/types.ts";

export default (async (_, ctx) => {
  const resp = await ctx.next();
  resp.headers.set("server", "nadder server");
  return resp;
}) as Middleware["handler"];
