import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyMigrations, setSettings } from "./helpers/d1";

// The Worker entry (workers/app.ts), as far as it is germomics' own: the rate limiter before the app, the signed-in
// admin kept out of the stored pages, the 410 for a deleted post's address, and the nightly job list. The gateway
// itself (Carrel's step, CSP reports, the context, the plain 500, the 404 count) is site-runtime ./worker's, tested
// there. React Router's request handler and the backup runs are replaced so only the entry is under test.
const h = vi.hoisted(() => ({
  render: vi.fn(
    async (_req: Request, _ctx: unknown) =>
      new Response("<p>page</p>", { headers: { "Content-Type": "text/html" } }),
  ),
  backup: vi.fn(async (_env: unknown) => {}),
  audio: vi.fn(async (_env: unknown) => {}),
}));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  createRequestHandler: () => h.render,
}));
// The build the gateway reads its stylesheets and route names from, which only Vite makes.
vi.mock("virtual:react-router/server-build", () => ({ routes: {}, assets: { routes: {} } }));
vi.mock("~/lib/backup.server", () => ({
  runBackup: h.backup,
  runAudioBackup: h.audio,
  runImagesBackup: async () => {},
  runGameAssetsBackup: async () => {},
}));

const e = env as unknown as Env;
const ORIGIN = "https://germomics.com";
let worker: typeof import("../workers/app").default;

// The Renderer entrypoint the gateway sends a cacheable read to (ctx.exports), recording each cache key and purge.
function ctx() {
  const pending: Promise<unknown>[] = [];
  const stored: string[] = [];
  const purges: string[] = [];
  return {
    pending,
    stored,
    purges,
    waitUntil: (p: Promise<unknown>) => pending.push(p),
    passThroughOnException() {},
    exports: {
      Renderer: {
        fetch: async (_r: Request, init: { cf: { cacheKey: string } }) => (
          stored.push(init.cf.cacheKey),
          new Response("stored", { headers: { "Content-Type": "text/html" } })
        ),
        purgePages: async (why: string) => void purges.push(why),
      },
    },
  } as unknown as ExecutionContext & {
    pending: Promise<unknown>[];
    stored: string[];
    purges: string[];
  };
}
const fetchWith = (request: Request, over: Partial<Env> = {}, c = ctx()) =>
  worker.fetch!(request as never, { ...e, CARREL_SITE_KEY: undefined, ...over } as Env, c);

beforeAll(async () => {
  await applyMigrations(e.DB);
  worker = (await import("../workers/app")).default;
}, 120_000);
beforeEach(async () => {
  h.render.mockClear();
  h.backup.mockClear();
  h.audio.mockClear();
  const { keys } = await e.APP_KV.list();
  await Promise.all(keys.map((k) => e.APP_KV.delete(k.name)));
});

describe("the Worker entry", () => {
  it("rate-limits /admin before rendering", async () => {
    await setSettings(e.DB, { "ratelimit.admin": "1" });
    const admin = () =>
      new Request(`${ORIGIN}/admin`, { headers: { "cf-connecting-ip": "198.51.100.5" } });
    expect((await fetchWith(admin())).status).toBe(200);
    const limited = await fetchWith(admin());
    expect(limited.status).toBe(429);
    expect(h.render).toHaveBeenCalledTimes(1);
  });

  // A stored page goes to every reader, so the admin's ?preview, which shows drafts, must never reach the Renderer
  // (CLAUDE.md rule 5: a scheduled post would leak), and an admin save purges.
  it("keeps the signed-in admin and writes out of the stored pages", async () => {
    const c = ctx();
    const { stored, purges } = c;
    await fetchWith(new Request(`${ORIGIN}/episodes?utm_source=x`), {}, c);
    expect(stored).toEqual(["/episodes;host=germomics.com"]);

    const admin = await fetchWith(
      new Request(`${ORIGIN}/writing?preview`, { headers: { Cookie: "CF_Authorization=abc" } }),
      {},
      c,
    );
    expect(admin.headers.get("Cache-Control")).toBe("private, no-store");
    await fetchWith(new Request(`${ORIGIN}/admin/posts/1`, { method: "POST", body: "x" }), {}, c);
    expect(stored).toHaveLength(1);
    expect(h.render).toHaveBeenCalledTimes(2);
    expect(purges).toEqual(["POST /admin/posts/1"]);
  });

  it("answers 410 for a deleted post's address", async () => {
    const notFound = async () =>
      new Response("<p>gone</p>", { status: 404, headers: { "Content-Type": "text/html" } });
    const c = ctx();
    // The tombstone site-api 0.22.0 keeps for a deleted or trashed post (drizzle/0026): 410, uncached, unindexed, and not a miss to count.
    await e.DB.prepare("INSERT INTO gone_paths (path, gone_at) VALUES (?, ?)")
      .bind("/blog/deleted-post", "2026-11-05T00:00:00Z")
      .run();
    h.render.mockImplementationOnce(notFound);
    // A cookie keeps the read from the (stubbed) Renderer, so the app's own 404 is what is tombstoned.
    const gone = await fetchWith(
      new Request(`${ORIGIN}/blog/deleted-post?t=1`, {
        headers: { Cookie: "CF_Authorization=abc" },
      }),
      {},
      c,
    );
    expect(gone.status).toBe(410);
    expect(gone.headers.get("cache-control")).toBe("no-store");
    expect(gone.headers.get("x-robots-tag")).toBe("noindex");
  });
});

const nightly = { cron: "17 3 * * *", scheduledTime: Date.now() } as ScheduledController;

describe("the nightly jobs", () => {
  it("runs each before the invocation returns and records it for /health", async () => {
    await worker.scheduled!(nightly, e, ctx());
    expect(h.backup).toHaveBeenCalledWith(e);
    expect(h.audio).toHaveBeenCalledWith(e);
    const ok = await e.DB.prepare(
      "SELECT name FROM cron_runs WHERE last_ok_at IS NOT NULL ORDER BY name",
    ).all<{ name: string }>();
    expect(ok.results.map((r) => r.name)).toEqual([
      "audio-backup",
      "backup",
      "game-assets-backup",
      "images-backup",
      "page-dates",
      "prune-404",
    ]);
  });

  it("runs the rest after a failed backup, then fails the invocation", async () => {
    h.backup.mockImplementationOnce(async () => {
      throw new Error("dump failed");
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(worker.scheduled!(nightly, e, ctx())).rejects.toThrow("cron jobs failed: backup");
    expect(h.audio).toHaveBeenCalledWith(e);
    spy.mockRestore();
  });
});
