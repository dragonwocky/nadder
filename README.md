# 🐍 nadder

**nadder** is a HTTP and WebSocket router for Deno,
built primarily for personal use.

- It can handle **any request method**.
- It matches routes based on the
  **[URL Pattern API](https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API)**.
- It includes a **PostgreSQL** connection wrapper.
- It includes in-memory or PostgresSQL **session storage** with garbage collection and expiry.
- It includes a **[Windi CSS](https://windicss.org/) processor**.
- It includes a **JSX transformer** (without React).
- It provides utilities for responding to requests with
  **static files, HTML, JSON, or HTTP status codes**.
- It provides simple **reading and manipulation of cookies**.

## Quick start

```tsx
/**
 * @jsx h
 * @jsxFrag jsxFrag
 */

import 'https://deno.land/x/dotenv/load.ts';

import {
  h,
  jsxFrag,
  jsxResponse,
  postgresConnection,
  postgresSession,
  route,
  serve,
  unoInstance,
} from 'https://deno.land/x/nadder/mod.ts';

const postgres = postgresConnection({
    password: Deno.env.get('POSTGRES_PWD'),
    hostname: Deno.env.get('POSTGRES_HOST'),
  }),
  session = await postgresSession(postgres);

route('GET', '/{index.html}?', async (ctx) => {
  const count = (((await session.get(ctx, 'count')) as number) ?? -1) + 1;
  await session.set(ctx, 'count', count);

  const { uno, sheet } = unoInstance();
  jsxResponse(
    ctx,
    <>
      <p class={uno`font-bold m-4`}>
        Page load count: <span class={uno`text-green-600`}>{count}</span>
      </p>
      {await sheet()}
    </>
  );
});

serve();
```

All other features are also made available as exports of the `mod.ts` file
(inc. e.g. registering WebSocket listeners, sending JSON responses, serving files
and initialising in-memory session storage).

For convenience, the following dependencies are re-exported:

- `setCookie`, `deleteCookie`, `Cookie`, `HTTPStatus` and `HTTPStatusText` from [`std/http`](https://deno.land/std/http).
- `contentType` from [`https://deno.land/x/media_types`](https://deno.land/x/media_types)

---

Changes to this project are recorded in the [CHANGELOG](CHANGELOG.md).

This project is licensed under the [MIT License](LICENSE).

To support future development of this project, please consider
[sponsoring the author](https://github.com/sponsors/dragonwocky).
