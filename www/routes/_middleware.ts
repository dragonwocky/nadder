import { Handler } from "nadder/types.ts";

export default (async (_, ctx) => {
  const res = await ctx.next!();
  res.headers.set("server", "nadder server");
  return res;
}) as Handler;
