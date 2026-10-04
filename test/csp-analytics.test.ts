import { describe, expect, it } from "vitest";

import { withSecurityHeaders } from "~/lib/security.server";

// Web Analytics (Dustin's ruling, 2026-10-03): one beacon, injected automatically by Cloudflare.
// script-src keeps its host. It reports to this origin's /cdn-cgi/rum, so connect-src must not
// list cloudflareinsights.com, which only the removed hand-installed beacon used.
describe("the CSP and Cloudflare Web Analytics", () => {
  const csp =
    withSecurityHeaders(new Response("ok"), "https://germomics.com").headers.get(
      "Content-Security-Policy-Report-Only",
    ) ?? "";
  const directive = (name: string) =>
    csp
      .split(";")
      .map((d) => d.trim())
      .find((d) => d.startsWith(`${name} `)) ?? "";

  it("keeps the automatic beacon's script host", () => {
    expect(directive("script-src").split(" ")).toContain("https://static.cloudflareinsights.com");
  });

  it("does not let pages connect to cloudflareinsights.com", () => {
    expect(directive("connect-src")).not.toBe("");
    expect(directive("connect-src").split(" ")).not.toContain("https://cloudflareinsights.com");
  });
});
