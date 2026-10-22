import { describe, expect, it } from "vitest";
import { previewToken, verifyPreviewToken } from "~/lib/preview.server";

// Preview links let anyone holding the URL read an unpublished post, so the token is the whole
// lock: it must be stable for one post, differ between posts and between secrets, and be refused
// on any other value.
const env = { BETTER_AUTH_SECRET: "test-only-secret-not-a-real-one" } as unknown as Env;
const other = { BETTER_AUTH_SECRET: "a-different-test-secret" } as unknown as Env;

describe("preview tokens", () => {
  it("is a stable 32-character hex token per post", async () => {
    const t = await previewToken(env, 7);
    expect(t).toMatch(/^[0-9a-f]{32}$/);
    expect(await previewToken(env, 7)).toBe(t);
  });

  it("differs between posts and between secrets", async () => {
    const t = await previewToken(env, 7);
    expect(await previewToken(env, 8)).not.toBe(t);
    expect(await previewToken(other, 7)).not.toBe(t);
  });

  it("verifies the post's own token and refuses everything else", async () => {
    const t = (await previewToken(env, 7)) as string;
    expect(await verifyPreviewToken(env, 7, t)).toBe(true);
    expect(await verifyPreviewToken(env, 8, t)).toBe(false);
    expect(await verifyPreviewToken(other, 7, t)).toBe(false);
    expect(await verifyPreviewToken(env, 7, "")).toBe(false);
    expect(await verifyPreviewToken(env, 7, t.slice(0, 31))).toBe(false);
    expect(await verifyPreviewToken(env, 7, `${t}0`)).toBe(false);
    const flipped = (t[0] === "0" ? "1" : "0") + t.slice(1);
    expect(await verifyPreviewToken(env, 7, flipped)).toBe(false);
    const lastFlipped = t.slice(0, 31) + (t[31] === "0" ? "1" : "0");
    expect(await verifyPreviewToken(env, 7, lastFlipped)).toBe(false);
  });

  it("makes no token and accepts none when the Worker has no secret", async () => {
    const none = {} as unknown as Env;
    expect(await previewToken(none, 7)).toBeNull();
    expect(await verifyPreviewToken(none, 7, (await previewToken(env, 7)) as string)).toBe(false);
  });
});
