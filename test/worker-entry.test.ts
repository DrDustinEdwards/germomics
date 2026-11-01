import { env } from "cloudflare:test";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyMigrations, setSettings } from "./helpers/d1";

// The Worker entry (workers/app.ts): the order a request passes through (Carrel's API, then the
// rate limiter, then the app behind the edge cache), the signed-in admin kept out of the stored pages, the
// plain 500 that never leaks an error, and the nightly jobs, one failure of which must neither stop the
// others nor be swallowed. React Router's request handler and the backup runs are replaced so only the
// entry is under test.
const h = vi.hoisted(() => ({
  render: vi.fn(async (_req: Request, _ctx: unknown) => new Response("<p>page</p>", { headers: { "Content-Type": "text/html" } })),
  backup: vi.fn(async (_env: unknown) => {}),
  audio: vi.fn(async (_env: unknown) => {}),
}));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  createRequestHandler: () => h.render,
}));
vi.mock("~/lib/backup.server", () => ({ runBackup: h.backup, runAudioBackup: h.audio, runImagesBackup: async () => {} }));

const e = env as unknown as Env;
const ORIGIN = "https://germomics.com";
let worker: typeof import("../workers/app").default;

function ctx() {
  const pending: Promise<unknown>[] = [];
  return { pending, waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException() {} } as unknown as ExecutionContext & { pending: Promise<unknown>[] };
}
const fetchWith = (request: Request, over: Partial<Env> = {}, c = ctx()) =>
  worker.fetch!(request as never, { ...e, CARREL_SITE_KEY: undefined, ...over } as Env, c);
let n = 0;
const fresh = (path = "/") => `${ORIGIN}${path}?t=${++n}`;

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
afterEach(() => vi.unstubAllEnvs());

describe("the Worker entry", () => {
  it("answers Carrel's API itself, before the app or the rate limiter", async () => {
    const res = await fetchWith(new Request(`${ORIGIN}/api/carrel/v1/meta`));
    expect(res.status).toBe(503);
    expect(h.render).not.toHaveBeenCalled();
  });

  it("rate-limits /admin before rendering", async () => {
    await setSettings(e.DB, { "ratelimit.admin": "1" });
    const admin = () => new Request(`${ORIGIN}/admin`, { headers: { "cf-connecting-ip": "198.51.100.5" } });
    expect((await fetchWith(admin())).status).toBe(200);
    const limited = await fetchWith(admin());
    expect(limited.status).toBe(429);
    expect(h.render).toHaveBeenCalledTimes(1);
  });

  it("logs a CSP report, per address, before the app", async () => {
    const report = () =>
      new Request(`${ORIGIN}/csp-report`, {
        method: "POST",
        headers: { "Content-Type": "application/csp-report", "cf-connecting-ip": "198.51.100.7" },
        body: JSON.stringify({ "csp-report": { "document-uri": `${ORIGIN}/data/x?q=1`, "effective-directive": "font-src", "blocked-uri": "https://fonts.gstatic.com/s/roboto.woff2" } }),
      });
    const keys: string[] = [];
    let open = true;
    const limiter = { limit: async ({ key }: { key: string }) => (keys.push(key), { success: open }) };
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    // Every request also writes its `request` line (site-runtime withRequestLog); only the reports are counted here.
    const reports = () => log.mock.calls.map(([line]) => JSON.parse(line as string)).filter((line) => line.event === "csp-violation");

    const res = await fetchWith(report(), { CSP_REPORT_RATE_LIMIT: limiter } as never);
    expect(res.status).toBe(204);
    expect(reports()[0]).toMatchObject({ event: "csp-violation", directive: "font-src", blocked: "https://fonts.gstatic.com/s/roboto.woff2", page: `${ORIGIN}/data/x` });
    expect(keys).toEqual(["198.51.100.7"]);

    // Over the limit, or with no limiter bound, the report is dropped and still answered 204.
    open = false;
    expect((await fetchWith(report(), { CSP_REPORT_RATE_LIMIT: limiter } as never)).status).toBe(204);
    expect((await fetchWith(report())).status).toBe(204);
    expect(reports()).toHaveLength(1);
    expect(h.render).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it("hands the app a context carrying the bindings", async () => {
    await fetchWith(new Request(fresh()));
    const [request, context] = h.render.mock.calls[0];
    expect(new URL(request.url).pathname).toBe("/");
    const { cloudflareContext } = await import("~/lib/context.server");
    expect((context as { get: (k: unknown) => { env: Env } }).get(cloudflareContext).env.DB).toBe(e.DB);
  });

  it("in development renders live", async () => {
    vi.stubEnv("DEV", true);
    const res = await fetchWith(new Request(fresh()));
    expect(await res.text()).toBe("<p>page</p>");
  });

  // A stored page goes to every reader, so the admin's ?preview, which shows drafts, must never reach the Renderer
  // (CLAUDE.md rule 5: a scheduled post would leak), and an admin save purges.
  it("in production keeps the signed-in admin and writes out of the stored pages", async () => {
    vi.stubEnv("DEV", false);
    const stored: string[] = [];
    const purges: string[] = [];
    const c = Object.assign(ctx(), {
      exports: {
        Renderer: {
          fetch: async (_r: Request, init: { cf: { cacheKey: string } }) => (stored.push(init.cf.cacheKey), new Response("stored")),
          purgePages: async (why: string) => void purges.push(why),
        },
      },
    });
    await fetchWith(new Request(`${ORIGIN}/episodes?utm_source=x`), {}, c);
    expect(stored).toEqual(["/episodes"]);

    const admin = await fetchWith(new Request(`${ORIGIN}/writing?preview`, { headers: { Cookie: "CF_Authorization=abc" } }), {}, c);
    expect(admin.headers.get("Cache-Control")).toBe("private, no-store");
    await fetchWith(new Request(`${ORIGIN}/admin/posts/1`, { method: "POST", body: "x" }), {}, c);
    expect(stored).toHaveLength(1);
    expect(h.render).toHaveBeenCalledTimes(2);
    expect(purges).toEqual(["admin POST /admin/posts/1"]);
  });

  it("counts a 404 with its referring host, but never a preview link's, whose path carries its token", async () => {
    const notFound = async () => new Response("<p>gone</p>", { status: 404, headers: { "Content-Type": "text/html" } });
    h.render.mockImplementationOnce(notFound);
    const c = ctx();
    await fetchWith(new Request(`${ORIGIN}/moved-page`, { headers: { Referer: "https://example.com/links?x=1" } }), {}, c);
    // A preview link: site-api answers it (here 503, the test Worker has no key), noindex, before the app.
    const link = await fetchWith(new Request(`${ORIGIN}/preview/secret-token`), {}, c);
    expect(link.headers.get("x-robots-tag")).toContain("noindex");
    await Promise.all(c.pending);
    const rows = await e.DB.prepare("SELECT path, referrer_host, hit_count FROM page_404_daily").all();
    expect(rows.results).toEqual([{ path: "/moved-page", referrer_host: "example.com", hit_count: 1 }]);
  });

  it("answers a plain 500 with no detail when rendering throws", async () => {
    h.render.mockImplementationOnce(async () => {
      throw new Error("secret stack detail");
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await fetchWith(new Request(fresh()));
    expect(res.status).toBe(500);
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(await res.text()).toBe("Internal Server Error");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

const nightly = { cron: "17 3 * * *", scheduledTime: Date.now() } as ScheduledController;

describe("the nightly jobs", () => {
  it("runs each before the invocation returns and records it for /health", async () => {
    await worker.scheduled!(nightly, e);
    expect(h.backup).toHaveBeenCalledWith(e);
    expect(h.audio).toHaveBeenCalledWith(e);
    const ok = await e.DB.prepare("SELECT name FROM cron_runs WHERE last_ok_at IS NOT NULL ORDER BY name").all<{ name: string }>();
    expect(ok.results.map((r) => r.name)).toEqual(["audio-backup", "backup", "images-backup", "prune-404"]);
  });

  it("runs the rest after a failed backup, then fails the invocation", async () => {
    h.backup.mockImplementationOnce(async () => {
      throw new Error("dump failed");
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(worker.scheduled!(nightly, e)).rejects.toThrow("cron jobs failed: backup");
    expect(h.audio).toHaveBeenCalledWith(e);
    spy.mockRestore();
  });
});
