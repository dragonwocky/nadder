import { type Plugin } from "../server/types.ts";

export default {
  targetFileExtensions: [".txt"],
  routePreprocessor: (body, _ctx) => `<em>${body}</em>`,
  routeRenderer: (body, _ctx) => `<p>${body}</p>`,
  routePostprocessor: (body, ctx) => {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${ctx.state.get("title") ?? ""}</title>
</head>
<body>${body}</body>
</html>`;
  },
} as Plugin<string>;
