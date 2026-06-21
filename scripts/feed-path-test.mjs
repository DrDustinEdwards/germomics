// Feed path-shape test — the /feed/podcast/ URL is sacred: podcast directories poll that exact
// path (with the trailing slash). It must serve 200 XML there and must NOT redirect to/from a
// non-slash variant. Run against the dev server before any cutover:
//   node scripts/feed-path-test.mjs http://localhost:5173
const BASE = process.argv[2] || process.env.BASE || "http://localhost:5173";
let failed = 0;
const check = (name, cond, detail = "") => {
  console.log(`${cond ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failed++;
};

// 1. The trailing-slash URL serves directly: 200, no redirect, XML.
const slash = await fetch(`${BASE}/feed/podcast/`, { redirect: "manual" });
check("/feed/podcast/ returns 200 (not a redirect)", slash.status === 200, `status ${slash.status}`);
const ct = slash.headers.get("content-type") || "";
check("/feed/podcast/ content-type is XML", /xml/i.test(ct), ct || "(none)");
const body = await slash.text();
check("body is RSS with a <channel>", body.includes("<rss") && body.includes("<channel>"));
check("self atom:link is /feed/podcast/", body.includes("/feed/podcast/"));
check("enclosure points at media.germomics.com", body.includes("media.germomics.com"));
check("guid is permanent (isPermaLink=\"false\")", body.includes('isPermaLink="false"'));
check("itunes channel tags present", body.includes("<itunes:author>") && body.includes("podcast:locked"));

// 2. The non-slash URL must ALSO serve directly (no forced redirect either way).
const noslash = await fetch(`${BASE}/feed/podcast`, { redirect: "manual" });
check("/feed/podcast (no slash) is not a redirect", noslash.status === 200, `status ${noslash.status}`);

console.log(failed === 0 ? "\nFEED PATH OK" : `\n${failed} CHECK(S) FAILED`);
process.exit(failed ? 1 : 0);
