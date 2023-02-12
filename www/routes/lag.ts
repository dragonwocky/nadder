import { Context, Handler } from "nadder/types.ts";

// export default (ctx: Context) => {
//   return `<script>console.log(Date.now()-${Date.now()})</script>`;
// };

export const POST: Handler = (req, ctx) => {
  return Response.json({ post: "received" });
};
