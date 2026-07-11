// One-off: insert the two inline figures (topic image, then pathogen image, in on-page order) into
// posts.body for episodes 1-9, near-top before the first <h2>, matching the ep10 figure pattern
// (insert-ep10-figures.mjs). Reads bodies from a wrangler JSON dump, validates each post has no
// existing <figure> and starts with an <h2>, then writes update-ep1-9.sql.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";

const TMP = os.tmpdir();
const IMG = "https://images.germomics.com";

// Strip a leading BOM (PowerShell Out-File adds one) before JSON.parse.
const raw = readFileSync(join(TMP, "ep1-9-fetch.json"), "utf8").replace(/^﻿/, "");
const rows = JSON.parse(raw)[0].results;
const byId = new Map(rows.map((r) => [r.id, r.body]));

function figure({ base, slug, alt, caption, credit, variants, w, h }) {
  const src = `${IMG}/${base}/${slug}-${variants[variants.length - 1]}.webp`;
  const srcset = variants.map((v) => `${IMG}/${base}/${slug}-${v}.webp ${v}w`).join(", ");
  const sizesAttr = variants.length > 1 ? ` sizes="(max-width: 400px) 100vw, 400px"` : "";
  const srcsetAttr = variants.length > 1 ? ` srcset="${srcset}"` : "";
  return (
    `<figure><img src="${src}"${srcsetAttr}${sizesAttr} alt="${alt}"` +
    ` width="${w}" height="${h}" loading="lazy" decoding="async">` +
    `<figcaption>${caption} <span class="cr">${credit}</span></figcaption></figure>`
  );
}

// id -> { base, images: [topic, pathogen] in on-page order }
const POSTS = {
  3: {
    base: "a-sky-full-of-sars",
    images: [
      { slug: "coronavirus", alt: "Black and white transmission electron micrograph showing several round coronavirus particles with a fringe of surface spike proteins", caption: "Coronavirus", credit: "© Fred Murphy, CDC, public domain", variants: [400, 795], w: 400, h: 300 },
      { slug: "civet", alt: "An Asian palm civet lying inside a wire cage, looking toward the camera", caption: "Asian palm civet", credit: "© Wikimedia Commons, CC BY-SA 2.0", variants: [400, 795], w: 400, h: 300 },
    ],
  },
  4: {
    base: "on-the-right-taq",
    images: [
      { slug: "yellowstone-hot-springs", alt: "Colorful green, orange, and white microbial mats along a runoff channel at a Yellowstone thermal spring", caption: "Yellowstone thermal spring", credit: "© Brian Schaller, FAL", variants: [795], w: 400, h: 300 },
      { slug: "thermus-aquaticus", alt: "Grayscale micrograph of long, thread-like Thermus aquaticus bacteria tangled together", caption: "Thermus aquaticus", credit: "© Diane Montpetit, public domain", variants: [400, 795], w: 400, h: 300 },
    ],
  },
  5: {
    base: "confessions-of-a-cholera-girl",
    images: [
      { slug: "hurricane-matthew", alt: "Satellite image of Hurricane Matthew showing a well-defined eye surrounded by dense cloud bands", caption: "Hurricane Matthew", credit: "© NOAA, public domain", variants: [400, 795], w: 400, h: 300 },
      { slug: "vibrio-cholerae", alt: "Scanning electron micrograph of densely packed, curved rod-shaped Vibrio cholerae bacteria", caption: "Vibrio cholerae", credit: "© Kirn, et al, public domain", variants: [400, 795], w: 400, h: 300 },
    ],
  },
  6: {
    base: "one-flew-over-the-kuru-nest",
    images: [
      { slug: "truckee-river", alt: "Snow-covered pine trees and a partially frozen Truckee River in winter", caption: "Truckee River Donner Party Camp", credit: "© Bruce Cooper, CC BY-SA 3.0", variants: [795], w: 400, h: 300 },
      { slug: "kuru", alt: "Two cross-sectioned lobes of a Kuru-infected cerebellum showing degenerated, discolored brain tissue", caption: "Cerebellum with Kuru", credit: "© D.C. Gajdusek, CC BY 3.0", variants: [795], w: 400, h: 300 },
    ],
  },
  7: {
    base: "its-on-the-syphilis",
    images: [
      { slug: "dilophosaurus", alt: "Mounted Dilophosaurus fossil skeleton showing the skull, vertebral column, and limb bones", caption: "Dilophosaurus", credit: "© Eduard Solà, CC BY-SA 3.0", variants: [795], w: 400, h: 300 },
      { slug: "treponema-pallidum", alt: "Grayscale micrograph of spiral, corkscrew-shaped Treponema pallidum bacteria", caption: "Treponema pallidum", credit: "© David Cox, public domain", variants: [795], w: 400, h: 300 },
    ],
  },
  8: {
    base: "theres-something-about-typhoid-mary",
    images: [
      { slug: "theodore-roosevelt", alt: "Black and white portrait of Theodore Roosevelt wearing pince-nez glasses and a dark suit", caption: "Theodore Roosevelt", credit: "© Library of Congress, public domain", variants: [400, 795], w: 400, h: 300 },
      { slug: "salmonella-enterica-typhi", alt: "Colorized micrograph of orange, rod-shaped Salmonella enterica Typhi bacteria", caption: "Salmonella enterica typhi", credit: "© CDC, public domain", variants: [400, 795], w: 400, h: 300 },
    ],
  },
  9: {
    base: "a-boy-named-flu",
    images: [
      { slug: "influenza", alt: "Colorized transmission electron micrograph of clustered, round influenza virus particles with a fuzzy surface texture", caption: "Influenza Virus", credit: "© CDC, public domain", variants: [400, 795], w: 400, h: 300 },
      { slug: "christopher-columbus", alt: "Oil painting portrait said to depict Christopher Columbus, wearing a dark hat and cloak", caption: "Christopher Columbus", credit: "© Sebastiano del Piombo, public domain", variants: [400, 795], w: 400, h: 300 },
    ],
  },
  10: {
    base: "rabies-day-out",
    images: [
      { slug: "edgar-allen-poe", alt: "Black and white photographic portrait of Edgar Allan Poe, circa 1849", caption: "Edgar Allan Poe", credit: "Public domain", variants: [795], w: 400, h: 300 },
      { slug: "rabies", alt: "Colorized micrograph of elongated, bullet-shaped rabies virus particles", caption: "Rabies Virus", credit: "© F. Murphy, UTMB, public domain", variants: [795], w: 400, h: 300 },
    ],
  },
  11: {
    base: "hell-on-weils",
    images: [
      { slug: "brazil-carnival", alt: "A costumed performer in an elaborate white feathered headdress and outfit on a Rio Carnival float at night", caption: "Carnival de Brazil", credit: "CC BY-SA 4.0", variants: [400, 795], w: 400, h: 300 },
      { slug: "leptospira", alt: "Scanning electron micrograph of two thin, tightly coiled Leptospira bacteria with hooked ends", caption: "Leptospira", credit: "© Janice Carr, CDC, public domain", variants: [400, 795], w: 400, h: 291 },
    ],
  },
};

const results = [];
let sql = "";

for (const [idStr, post] of Object.entries(POSTS)) {
  const id = Number(idStr);
  const body = byId.get(id);
  if (typeof body !== "string" || body.length < 500) throw new Error(`post ${id}: body not found / too short`);
  if (body.includes("<figure")) throw new Error(`post ${id}: body already contains a <figure> (already inserted?)`);
  if (!body.startsWith("<h2")) throw new Error(`post ${id}: body does not start with <h2> as expected`);

  const figs = post.images.map((img) => figure({ base: post.base, ...img })).join("\n");
  const out = figs + "\n" + body;

  const figCount = (out.match(/<figure/g) || []).length;
  if (figCount !== 2) throw new Error(`post ${id}: expected 2 figures, got ${figCount}`);
  if (!out.startsWith("<figure")) throw new Error(`post ${id}: figures not at very top`);

  const escaped = out.replace(/'/g, "''");
  sql += `UPDATE posts SET body='${escaped}', updated_at=updated_at WHERE id=${id};\n`;
  results.push({ id, base: post.base, original_len: body.length, new_len: out.length, figures: figCount });
}

writeFileSync(join(TMP, "update-ep1-9.sql"), sql, "utf8");
console.log(JSON.stringify(results, null, 2));
console.log("sql_bytes=" + sql.length);
