import { createRouter, publicQuery } from "./middleware";
import { dataRouter } from "./dataRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  data: dataRouter,
});

export type AppRouter = typeof appRouter;
