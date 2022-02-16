/**
 * @jsx h
 * @jsxFrag jsxFrag
 */

import "https://deno.land/x/dotenv/load.ts";

import nadder, {
  Document,
  h,
  jsxFrag,
  postgresConnection,
  postgresSession,
} from "./mod.ts";

const postgres = postgresConnection({
    password: Deno.env.get("POSTGRES_PWD"),
    hostname: Deno.env.get("POSTGRES_HOST"),
  }),
  session = await postgresSession(postgres);

nadder.handleRoute("GET", "/{index.html}?", async (ctx) => {
  const count = (((await session.get(ctx, "count")) as number) ?? -1) + 1;
  await session.set(ctx, "count", count);

  ctx.res.body = await Document(
    "Home",
    <>
      <h1 class="text-green-600">Hello world!</h1>
      <p>
        Page load count: <span class="font-bold">{count}</span>
      </p>
    </>,
  );
  ctx.res.inferContentType("html");

  const socket = ctx.upgrade.socket();
  if (!socket) return;
  socket.onmessage = (ev) => {
    if (ev.data === "channel") ctx.upgrade.channel.join("channel2");
    ctx.upgrade.channel.broadcast(ev.data);
  };
});

nadder.listenAndServe();
