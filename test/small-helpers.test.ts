import { afterEach, describe, expect, it, vi } from "vitest";
import type { Post } from "~/db/schema";
import { APPLE_CATEGORIES } from "~/lib/apple-categories";
import { getDataset, listDatasets } from "~/lib/datasets.server";
import { computePeaks } from "~/lib/peaks";
import { slugifyGuest, toPlayerTrack } from "~/lib/posts";
import { captureException } from "~/lib/sentry.server";
import { SITE_ADDRESS, SITE_ADDRESS_LINE, postalAddressLd } from "~/lib/site";
import { DEFAULT_SHOW } from "~/lib/show.server";

// The small pure helpers. Where a hardcoded list mirrors a source of truth, the test derives the
// list and fails both ways, missing and extra (portfolio rule 3.4), with a count so an empty list
// cannot pass (rule 3.3).

describe("postalAddressLd", () => {
  it("defaults every field to the site address and takes any field from the setting", () => {
    expect(postalAddressLd()).toEqual({
      "@type": "PostalAddress",
      streetAddress: SITE_ADDRESS.streetAddress,
      addressLocality: SITE_ADDRESS.locality,
      addressRegion: SITE_ADDRESS.region,
      postalCode: SITE_ADDRESS.postalCode,
      addressCountry: SITE_ADDRESS.country,
    });
    expect(postalAddressLd({ locality: "Elsewhere", country: "CA" })).toMatchObject({ addressLocality: "Elsewhere", addressCountry: "CA", postalCode: SITE_ADDRESS.postalCode });
  });

  it("keeps the one-line address in step with the structured one", () => {
    expect(SITE_ADDRESS_LINE).toBe(`${SITE_ADDRESS.streetAddress}, ${SITE_ADDRESS.locality}, ${SITE_ADDRESS.region} ${SITE_ADDRESS.postalCode}`);
  });
});

describe("slugifyGuest", () => {
  it("lowercases, joins runs of other characters with one dash, and trims dashes", () => {
    expect(slugifyGuest("  Ada  Lovelace ")).toBe("ada-lovelace");
    expect(slugifyGuest("Dr. John O'Neil, Jr.")).toBe("dr-john-o-neil-jr");
    expect(slugifyGuest("Zoë Müller")).toBe("zoë-müller");
    expect(slugifyGuest("--A--")).toBe("a");
    expect(slugifyGuest("!!!")).toBe("");
  });
});

describe("toPlayerTrack", () => {
  const ep = { id: 7, slug: "ep", title: "Ep", audioUrl: "https://m/a.mp3", audioDuration: 61, episodeArtwork: "art", coverImage: "cover", episodeNumber: 3, chapters: [{ start: 0, title: "I" }] } as Post;

  it("maps an episode to what the player needs", () => {
    expect(toPlayerTrack(ep)).toEqual({ id: 7, slug: "ep", title: "Ep", audioUrl: "https://m/a.mp3", durationSec: 61, artwork: "art", episodeNumber: 3, chapters: [{ start: 0, title: "I" }] });
  });

  it("falls back to the cover for artwork, and to empty or null for anything missing", () => {
    expect(toPlayerTrack({ ...ep, episodeArtwork: null }).artwork).toBe("cover");
    expect(toPlayerTrack({ ...ep, episodeArtwork: null, coverImage: null }).artwork).toBeNull();
    expect(toPlayerTrack({ ...ep, audioUrl: null, audioDuration: null, episodeNumber: null, chapters: null })).toMatchObject({ audioUrl: "", durationSec: null, episodeNumber: null, chapters: [] });
  });
});

describe("the Apple Podcasts categories", () => {
  it("accepts every category the show ships with, so the editor never rejects its own default", () => {
    expect(DEFAULT_SHOW.categories!.length).toBeGreaterThan(0);
    for (const c of DEFAULT_SHOW.categories!) {
      expect(APPLE_CATEGORIES, c.category).toHaveProperty(c.category);
      if (c.subcategory) expect(APPLE_CATEGORIES[c.category], `${c.category} / ${c.subcategory}`).toContain(c.subcategory);
    }
    expect(APPLE_CATEGORIES).toHaveProperty(DEFAULT_SHOW.appleCategory);
  });
});

describe("the bundled datasets", () => {
  it("lists exactly the datasets getDataset can read, as summaries only", () => {
    const list = listDatasets();
    expect(list.length).toBeGreaterThan(0);
    for (const item of list) {
      expect(Object.keys(item).sort()).toEqual(["kind", "slug", "summary", "title"]);
      expect(getDataset(item.slug)?.title).toBe(item.title);
    }
    expect(getDataset("no-such-dataset")).toBeNull();
  });

  it("has a table whose rows match its columns, for every dataset", () => {
    for (const { slug } of listDatasets()) {
      const { table } = getDataset(slug)!;
      expect(table.rows.length, slug).toBeGreaterThan(0);
      for (const row of table.rows) expect(row, slug).toHaveLength(table.columns.length);
    }
  });
});

describe("computePeaks", () => {
  const f32 = (...v: number[]) => Float32Array.from(v);

  it("returns N integers from 0 to 100, with the loudest slice at 100", () => {
    const samples = Float32Array.from({ length: 4000 }, (_, i) => Math.sin(i / 7) * (i < 2000 ? 0.25 : 0.5));
    const peaks = computePeaks([samples]);
    expect(peaks).toHaveLength(400);
    expect(Math.max(...peaks)).toBe(100);
    expect(peaks.every((p) => Number.isInteger(p) && p >= 0 && p <= 100)).toBe(true);
    expect(peaks[10]).toBeLessThan(peaks[390]);
  });

  it("normalizes against the loudest slice, rounding to whole numbers", () => {
    expect(computePeaks([f32(0.5, 0.25, 0.1, 0)], 4)).toEqual([100, 50, 20, 0]);
    expect(computePeaks([f32(1, 0.3333)], 2)).toEqual([100, 33]);
  });

  it("returns all zeros for silence", () => {
    expect(computePeaks([new Float32Array(1000)], 10)).toEqual(new Array(10).fill(0));
  });

  it("takes the peak of the absolute value, so negative swings count", () => {
    expect(computePeaks([f32(-0.8, 0.2)], 2)).toEqual([100, 25]);
  });

  it("mixes channels down by averaging their absolute values", () => {
    expect(computePeaks([f32(1, 0), f32(-1, 0.5)], 2)).toEqual([100, 25]);
    expect(computePeaks([f32(1), f32(0)], 1)).toEqual([100]);
  });

  it("gives the final slice whatever samples are left over, and zeros when the audio is shorter than N", () => {
    expect(computePeaks([f32(0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.9)], 3)).toEqual([11, 11, 100]);
    expect(computePeaks([f32(0.5, 1)], 4)).toEqual([50, 100, 0, 0]);
  });
});

describe("captureException", () => {
  afterEach(() => vi.restoreAllMocks());
  const DSN = "https://publickey@o123.ingest.sentry.io/4567";
  const ctx = () => {
    const waited: Promise<unknown>[] = [];
    return { waited, ctx: { waitUntil: (p: Promise<unknown>) => waited.push(p) } as unknown as ExecutionContext };
  };
  const request = new Request("https://germomics.com/episodes/ep-1?secret=1", { method: "POST", headers: { Cookie: "a=b", Authorization: "Bearer x" }, body: "private body" });
  const sent = () => vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("ok"));

  it("does nothing without a DSN, or with one it cannot read", () => {
    const spy = sent();
    for (const SENTRY_DSN of [undefined, "", "not a url", "https://host/", "https://@host/123"]) {
      captureException({ SENTRY_DSN } as unknown as Env, new Error("x"), request, ctx().ctx);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("posts one event to the project's store URL with the key, and schedules it on waitUntil", async () => {
    const spy = sent();
    const c = ctx();
    captureException({ SENTRY_DSN: DSN } as unknown as Env, new TypeError("boom"), request, c.ctx);
    expect(spy).toHaveBeenCalledTimes(1);
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://o123.ingest.sentry.io/api/4567/store/");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-Sentry-Auth"]).toBe("Sentry sentry_version=7, sentry_key=publickey, sentry_client=germomics-worker/1.0");
    expect(c.waited).toHaveLength(1);
    await c.waited[0];
  });

  it("sends the error and the URL and method, and nothing from the request's headers or body", () => {
    const spy = sent();
    captureException({ SENTRY_DSN: DSN } as unknown as Env, new TypeError("boom"), request, ctx().ctx);
    const raw = String((spy.mock.calls[0][1] as RequestInit).body);
    const event = JSON.parse(raw);
    expect(event).toMatchObject({
      platform: "javascript",
      level: "error",
      transaction: "/episodes/ep-1",
      server_name: "germomics.com",
      request: { url: "https://germomics.com/episodes/ep-1?secret=1", method: "POST" },
      exception: { values: [{ type: "TypeError", value: "boom" }] },
    });
    expect(event.event_id).toMatch(/^[0-9a-f]{32}$/);
    expect(Math.abs(event.timestamp - Date.now() / 1000)).toBeLessThan(5);
    expect(event).toMatchObject({ logger: "worker", tags: { runtime: "cloudflare-workers" } });
    expect(raw).not.toContain("Bearer");
    expect(raw).not.toContain("a=b");
    expect(raw).not.toContain("private body");
  });

  it("sends the first line of the stack when there is one, and none when there is not", () => {
    const spy = sent();
    const withStack = new TypeError("boom");
    withStack.stack = "TypeError: boom\n    at somewhere (file.ts:1:1)";
    const without = new Error("quiet");
    without.stack = undefined;
    captureException({ SENTRY_DSN: DSN } as unknown as Env, withStack, request, ctx().ctx);
    captureException({ SENTRY_DSN: DSN } as unknown as Env, without, request, ctx().ctx);
    const [a, b] = spy.mock.calls.map((c) => JSON.parse(String((c[1] as RequestInit).body)).exception.values[0]);
    expect(a.stacktrace).toEqual({ frames: [{ function: "TypeError: boom" }] });
    expect(b).not.toHaveProperty("stacktrace");
  });

  it("wraps a thrown non-error, and names an error with no message", () => {
    const spy = sent();
    captureException({ SENTRY_DSN: DSN } as unknown as Env, "plain string", request, ctx().ctx);
    captureException({ SENTRY_DSN: DSN } as unknown as Env, new Error(""), request, ctx().ctx);
    const values = spy.mock.calls.map((c) => JSON.parse(String((c[1] as RequestInit).body)).exception.values[0]);
    expect(values[0]).toMatchObject({ type: "Error", value: "plain string" });
    expect(values[1]).toMatchObject({ value: "Unknown error" });
  });

  it("never throws into the request: a failed send, a failing waitUntil and a missing one are all swallowed", async () => {
    const env = { SENTRY_DSN: DSN } as unknown as Env;
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const c = ctx();
    expect(() => captureException(env, new Error("x"), request, c.ctx)).not.toThrow();
    await expect(c.waited[0]).resolves.toBeUndefined();
    const throwing = { waitUntil: () => { throw new Error("no ctx"); } } as unknown as ExecutionContext;
    expect(() => captureException(env, new Error("x"), request, throwing)).not.toThrow();
  });
});
