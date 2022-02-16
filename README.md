# 🐍 nadder

**nadder** is an opinionated HTTP/WebSocket server framework for Deno.

It includes **[URL Pattern](https://developer.mozilla.org/en-US/docs/Web/API/URL_Pattern_API)**
routing, post-route middleware, helpers for creating/reading/manipulating cookies and responses,
upgrading HTTP connections to WebSocket connections (inc. sorting into channels),
**PostgreSQL** (or in-memory) session storage (inc. garbage collection and expiry), a React-free
**JSX transformer** and atomic CSS with [**Uno**](https://github.com/unocss/unocss).

## Quick start

```tsx
/**
 * @jsx h
 * @jsxFrag jsxFrag
 */

import 'https://deno.land/x/dotenv@v3.1.0/load.ts';

import nadder, {
  Document,
  h,
  jsxFrag,
  postgresConnection,
  postgresSession,
} from 'https://deno.land/x/nadder@v0.2.0/mod.ts';

const postgres = postgresConnection({
    password: Deno.env.get('POSTGRES_PWD'),
    hostname: Deno.env.get('POSTGRES_HOST'),
  }),
  session = await postgresSession(postgres);

nadder.handleRoute('GET', '/{index.html}?', async (ctx) => {
  const count = (((await session.get(ctx, 'count')) as number) ?? -1) + 1;
  await session.set(ctx, 'count', count);

  ctx.res.body = await Document(
    'Home',
    <>
      <h1 class="text-green-600">Hello world!</h1>
      <p>
        Load count: <span class="font-bold">{count}</span>
      </p>
    </>
  );
  ctx.res.inferContentType('html');
});

nadder.listenAndServe();
```

All other features are also made available as exports of the `mod.ts` file.

For convenience, the following dependencies are re-exported:

- `setCookie`, `deleteCookie`, `Cookie`, `HTTPStatus` and `HTTPStatusText` from [`std/http`](https://deno.land/std/http).
- `contentType` from [`https://deno.land/x/media_types`](https://deno.land/x/media_types)

---

Changes to this project are recorded in the [CHANGELOG](CHANGELOG.md).

This project is licensed under the [MIT License](LICENSE).

To support future development of this project, please consider
[sponsoring the author](https://github.com/sponsors/dragonwocky).
