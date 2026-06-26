// One-off backfill: set posts.reading_time for rows where it is NULL, computed from the body with
// the same algorithm as app/lib/seo.ts readingTime() (strip HTML, ~200 wpm, floor 1). Writes ONLY
// the reading_time column (never body), so it is safe to run alongside a concurrent body cleanup.
// Reads a wrangler JSON dump from TEMP/missing-rt.json and emits TEMP/update-reading-time.sql.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

const TMP = os.tmpdir();

function stripHtml(html) {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function readingTime(html) {
  const words = stripHtml(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

const raw = readFileSync(join(TMP, "missing-rt.json"), "utf8").replace(/^﻿/, "");
const rows = JSON.parse(raw)[0].results;

const lines = [];
for (const r of rows) {
  if (r.reading_time != null) continue; // only touch NULLs
  const rt = readingTime(r.body ?? "");
  if (!Number.isInteger(rt) || rt < 1) throw new Error(`bad rt for id ${r.id}`);
  lines.push(`UPDATE posts SET reading_time=${rt} WHERE id=${r.id} AND reading_time IS NULL;`);
  console.log(`id=${r.id}\t${r.slug}\trt=${rt}`);
}
writeFileSync(join(TMP, "update-reading-time.sql"), lines.join("\n") + "\n", "utf8");
console.log("statements=" + lines.length);
