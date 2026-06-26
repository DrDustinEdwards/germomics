// One-off: insert the three episode-10 figures into posts.body (id 12) and emit an UPDATE .sql.
// Reads the current body from a wrangler JSON dump, validates each anchor appears exactly once,
// inserts the responsive <figure> blocks, and writes update-ep10.sql (+ a backup of the original).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

const TMP = os.tmpdir();
const IMG = "https://images.germomics.com";
const BASE = "antitoxin-togo-please";

// Strip a leading BOM (PowerShell Out-File adds one) before JSON.parse.
const raw = readFileSync(join(TMP, "ep10-fetch.json"), "utf8").replace(/^﻿/, "");
const body = JSON.parse(raw)[0].results[0].body;
if (typeof body !== "string" || body.length < 1000) throw new Error("body not found / too short");
writeFileSync(join(TMP, "ep10-body-original.html"), body, "utf8");

function figure({ slug, alt, caption, credit, w, h, sizes, loading }) {
  const src = `${IMG}/${BASE}/${slug}-795.webp`;
  const srcset = `${IMG}/${BASE}/${slug}-400.webp 400w, ${IMG}/${BASE}/${slug}-795.webp 795w`;
  return (
    `<figure><img src="${src}" srcset="${srcset}" sizes="${sizes}" alt="${alt}"` +
    ` width="${w}" height="${h}" loading="${loading}" decoding="async">` +
    `<figcaption>${caption} <span class="cr">${credit}</span></figcaption></figure>`
  );
}

const lead = figure({
  slug: "antitoxin-togo-pls",
  alt: "Continuous single-line illustration in purple of a musher driving a team of sled dogs through the snow",
  caption: "The 1925 serum run, drawn in a single continuous line.",
  credit: "© Germomics",
  w: 520, h: 391,
  sizes: "(max-width: 520px) 100vw, 520px",
  loading: "eager",
});

const coryne = figure({
  slug: "corynebacterium-diphtheriae",
  alt: "Light micrograph of Corynebacterium diphtheriae, rod-shaped bacteria stained purple-red on a pale pink background",
  caption: "Corynebacterium diphtheriae, Gram-stained, the crystal violet that gives Germomics its color.",
  credit: "© CDC, public domain",
  w: 400, h: 300,
  sizes: "(max-width: 400px) 100vw, 400px",
  loading: "lazy",
});

const seppala = figure({
  slug: "seppala-togo",
  alt: "Black and white photograph of Leonhard Seppala in fur arctic gear with his team of sled dogs, including Togo",
  caption: "Leonhard Seppala with his team, including Togo.",
  credit: "© Carrie McLain Museum, CC0",
  w: 400, h: 300,
  sizes: "(max-width: 400px) 100vw, 400px",
  loading: "lazy",
});

const DIPH_ANCHOR = "<h2>What Is Diphtheria?</h2>";
const TOGO_ANCHOR = "<h2>Togo vs. Balto: Who Was the True Hero?</h2>";

function countOccurrences(hay, needle) {
  let n = 0, i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}
for (const [label, anchor] of [["diphtheria", DIPH_ANCHOR], ["togo", TOGO_ANCHOR]]) {
  const c = countOccurrences(body, anchor);
  if (c !== 1) throw new Error(`anchor "${label}" appears ${c} times, expected 1`);
}
if (body.includes("<figure")) throw new Error("body already contains a <figure> (already inserted?)");

let out = lead + "\n" + body;
out = out.replace(DIPH_ANCHOR, coryne + "\n" + DIPH_ANCHOR);
out = out.replace(TOGO_ANCHOR, seppala + "\n" + TOGO_ANCHOR);

// Sanity: exactly 3 figures, all anchors still present once.
if (countOccurrences(out, "<figure") !== 3) throw new Error("expected 3 figures after insert");
if (!out.startsWith(lead)) throw new Error("lead not at very top");

writeFileSync(join(TMP, "ep10-body-new.html"), out, "utf8");
const escaped = out.replace(/'/g, "''");
const sql = `UPDATE posts SET body='${escaped}', updated_at=updated_at WHERE id=12;\n`;
writeFileSync(join(TMP, "update-ep10.sql"), sql, "utf8");

console.log("original_len=" + body.length);
console.log("new_len=" + out.length);
console.log("figures=" + countOccurrences(out, "<figure"));
console.log("sql_bytes=" + sql.length);
console.log("LEAD>>> " + lead.slice(0, 120) + " ...");
