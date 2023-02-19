import { Layout } from "nadder/server.ts";

export const title = "Title";

export default ((ctx) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${ctx.state.get("title")}</title>
</head>
<body style="margin: 0">
  ${ctx.state.get("content")}
</body>
</html>`;
}) as Layout["default"];
