/*! mit license (c) dragonwocky <thedragonring.bod@gmail.com> (https://dragonwocky.me/) */

/**
 * @jsx h
 * @jsxFrag jsxFrag
 */

import { HTTPStatus } from "./deps.ts";
import { handleRoute } from "./listen.ts";
import { h, jsxFrag, renderIsland } from "./render.tsx";

const cache: Map<string, Promise<string>> = new Map(),
  getId = () => {
    let uniqueId = crypto.randomUUID();
    while (cache.has(uniqueId)) uniqueId = crypto.randomUUID();
    return uniqueId;
  };

const Skeleton = (
    props: JSX.Props,
    children: JSX.Children,
  ) => {
    props.class = `block bg-neutral-300 motion-safe:animate-pulse
    ${props.class ?? ""}`;
    return <div {...props}>{children}</div>;
  },
  Spinner = () => (
    <div class="flex items-center justify-center h-full w-full opacity-85">
      <i class="i-ph:circle-notch w-4 h-4 block animate-spin"></i>
    </div>
  ),
  Failure = () => (
    <div class="flex items-center justify-center h-full w-full opacity-85">
      <i class="i-ph:file-x w-4 h-4 block mr-1.5"></i>
      Something went wrong.
    </div>
  );

const Stream = (
  {
    placeholder = <Spinner />,
    failed = <Failure />,
  }: { placeholder?: unknown; failed?: unknown },
  children: JSX.Children,
) => {
  const id = getId(),
    island = renderIsland(<>{children}</>);
  cache.set(id, island);
  return (
    <html-stream src={`/_stream/${id}`}>
      <html-stream-placeholder>{placeholder}</html-stream-placeholder>
      <html-stream-failed style="display:none">{failed}</html-stream-failed>
    </html-stream>
  );
};

handleRoute("GET", "/_stream/:id", async (ctx) => {
  const { id } = ctx.req.pathParams as { id: string };
  if (!cache.has(id)) ctx.res.sendStatus(HTTPStatus.NotFound);
  ctx.res.body = await cache.get(id)!;
  ctx.res.inferContentType("html");
  cache.delete(id);
});

export { Skeleton, Spinner, Stream };
