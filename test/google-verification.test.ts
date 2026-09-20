import { describe, expect, it } from "vitest";
import routes from "~/routes";
import { loader } from "~/routes/google-verification";

// PINS THE GOOGLE SEARCH CONSOLE PROOF. Verification is not a one-time event: Google re-requests
// this URL and un-verifies the property if the response changes. A refactor that renames the
// route, drops it below the `:slug` catch-all, or edits a character of the token would otherwise
// fail silently, months later, in a product nobody was testing at the time.

const EXPECTED = "google-site-verification: google7e6923f5a0eb8ba9.html";

describe("google search console verification", () => {
  it("returns exactly the line Google checks for", async () => {
    const res = await loader();
    expect(res.status).toBe(200);
    expect((await res.text()).trim()).toBe(EXPECTED);
  });

  it("serves it as html, which is what the .html URL implies", async () => {
    const res = await loader();
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  it("is registered at the exact path, ahead of the :slug catch-all", () => {
    // Not vacuous: the loader above would keep passing while the route was unreachable.
    const paths = routes.map((r) => ("path" in r ? r.path : undefined));
    const proof = paths.indexOf("google7e6923f5a0eb8ba9.html");
    const slug = paths.indexOf(":slug");
    expect(proof).toBeGreaterThan(-1);
    expect(slug).toBeGreaterThan(-1);
    expect(proof).toBeLessThan(slug);
  });
});
