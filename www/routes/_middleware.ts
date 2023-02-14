import { type Handler } from "nadder/server.ts";

export default (async (_, ctx) => {
  const res = await ctx.next!();
  res.headers.set("server", "nadder server");
  return res;
}) as Handler;
