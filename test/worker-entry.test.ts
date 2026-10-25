import { env } from "cloudflare:test";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyMigrations, setSettings } from "./helpers/d1";

// The Worker entry (workers/app.ts): the order a request passes through (Carrel's API, then the
// rate limiter, then the app behind the edge cache), the security headers on every answer, the
// plain 500 that never leaks an error, and the nightly backup whose failure must not be swallowed.
// React Router's request handler and the backup run are replaced so only the entry is under test.
const h = vi.hoisted(() => ({
  render: vi.fn(async (_req: Request, _ctx: unknown) => new Response("<p>page</p>", { headers: { "Content-Type": "text/html" } })),
  backup: vi.fn(async (_env: unknown) => {}),
}));
vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  createRequestHandler: () => h.render,
}));
vi.mock("~/lib/backup.server", () => ({ runBackup: h.backup }));

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
  const { keys } = await e.APP_KV.list();
  await Promise.all(keys.map((k) => e.APP_KV.delete(k.name)));
});
afterEach(() => vi.unstubAllEnvs());

describe("the Worker entry", () => {
  it("answers Carrel's API itself, with security headers, before the app or the rate limiter", async () => {
    const res = await fetchWith(new Request(`${ORIGIN}/api/carrel/v1/meta`));
    expect(res.status).toBe(503);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(h.render).not.toHaveBeenCalled();
  });

  it("rate-limits /admin before rendering, with security headers on the 429", async () => {
    await setSettings(e.DB, { "ratelimit.admin": "1" });
    const admin = () => new Request(`${ORIGIN}/admin`, { headers: { "cf-connecting-ip": "198.51.100.5" } });
    expect((await fetchWith(admin())).status).toBe(200);
    const limited = await fetchWith(admin());
    expect(limited.status).toBe(429);
    expect(limited.headers.get("X-Frame-Options")).toBe("deny");
    expect(h.render).toHaveBeenCalledTimes(1);
  });

  it("logs a CSP report the page's policy sends, per address, before the app", async () => {
    vi.stubEnv("DEV", true);
    const page = await fetchWith(new Request(fresh()));
    expect(page.headers.get("Content-Security-Policy-Report-Only")).toContain("report-uri /csp-report");
    expect(page.headers.get("Reporting-Endpoints")).toBe(`csp-endpoint="${ORIGIN}/csp-report"`);
    h.render.mockClear();

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

    const res = await fetchWith(report(), { CSP_REPORT_RATE_LIMIT: limiter } as never);
    expect(res.status).toBe(204);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({ event: "csp-violation", directive: "font-src", blocked: "https://fonts.gstatic.com/s/roboto.woff2", page: `${ORIGIN}/data/x` });
    expect(keys).toEqual(["198.51.100.7"]);

    // Over the limit, or with no limiter bound, the report is dropped and still answered 204.
    open = false;
    expect((await fetchWith(report(), { CSP_REPORT_RATE_LIMIT: limiter } as never)).status).toBe(204);
    expect((await fetchWith(report())).status).toBe(204);
    expect(log).toHaveBeenCalledTimes(1);
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

  it("in development renders live with security headers and never caches", async () => {
    vi.stubEnv("DEV", true);
    const url = fresh();
    const res = await fetchWith(new Request(url));
    expect(await res.text()).toBe("<p>page</p>");
    expect(res.headers.has("Strict-Transport-Security")).toBe(true);
    expect(res.headers.has("x-cache")).toBe(false);
  });

  it("in production serves public pages through the edge cache", async () => {
    vi.stubEnv("DEV", false);
    const c = ctx();
    const url = fresh("/episodes/");
    const first = await fetchWith(new Request(url), {}, c);
    expect(first.headers.get("x-cache")).toBe("MISS");
    await Promise.all(c.pending);
    const second = await fetchWith(new Request(url));
    expect(second.headers.get("x-cache")).toBe("HIT");
    expect(h.render).toHaveBeenCalledTimes(1);
  });

  it("answers a plain 500 with security headers and no detail when rendering throws", async () => {
    h.render.mockImplementationOnce(async () => {
      throw new Error("secret stack detail");
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await fetchWith(new Request(fresh()));
    expect(res.status).toBe(500);
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await res.text()).toBe("Internal Server Error");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("the nightly backup", () => {
  it("runs the backup before the invocation returns", async () => {
    await worker.scheduled!({} as ScheduledController, e);
    expect(h.backup).toHaveBeenCalledWith(e);
  });

  it("rethrows a failed backup so the invocation shows as failed", async () => {
    h.backup.mockImplementationOnce(async () => {
      throw new Error("dump failed");
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(worker.scheduled!({} as ScheduledController, e)).rejects.toThrow("dump failed");
    expect(spy).toHaveBeenCalledWith("Nightly backup failed:", expect.any(Error));
    spy.mockRestore();
  });
});
