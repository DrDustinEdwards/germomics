// Extract episode BODY + EXCERPT from the scraped season-1 episode pages (Divi/WordPress).
// Per the agreed mapping:
//   body    = intro summary paragraph(s) + a Credits block (links preserved). NO transcript.
//   excerpt = the intro summary as plain text (the richer page summary, not the feed one-liner).
// The "Show Notes" Divi toggle is the verbatim transcript and is deliberately EXCLUDED (it is
// stored separately as the VTT). Gallery images are skipped (decorative, still on the old host).
//
// Input : %TEMP%/ep/<slug>.html  (already fetched)
// Output: scripts/_generated/bodies.json  { [slug]: { body, excerpt } }
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const TMP = process.env.TEMP || process.env.TMP || "/tmp";

const SLUGS = [
  "a-sky-full-of-sars",
  "on-the-right-taq",
  "confessions-of-a-cholera-girl",
  "one-flew-over-the-kuru-nest",
  "its-on-the-syphilis",
  "theres-something-about-typhoid-mary",
  "a-boy-named-flu",
  "rabies-day-out",
  "hell-on-weils",
  "antitoxin-togo-please",
];

// Decode the typographic/character entities that appear in the prose. We keep &amp;/&lt;/&gt;
// as valid HTML entities in BODY (they're legal there); EXCERPT decodes those too (plain text).
const TYPO = {
  "&#8217;": "’", "&#8216;": "‘",
  "&#8220;": "“", "&#8221;": "”",
  "&#8211;": "–", "&#8212;": "—",
  "&#8230;": "…", "&#8242;": "′", "&#8243;": "″",
  "&#038;": "&", "&#39;": "'", "&#039;": "'",
  "&hellip;": "…", "&mdash;": "—", "&ndash;": "–",
  "&rsquo;": "’", "&lsquo;": "‘", "&ldquo;": "“", "&rdquo;": "”",
  "&nbsp;": " ",
};

function decodeTypo(s) {
  let out = s;
  for (const [k, v] of Object.entries(TYPO)) out = out.split(k).join(v);
  // Any remaining numeric decimal entities -> their char (covers stray punctuation).
  out = out.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
  return out;
}

function decodeAll(s) {
  return decodeTypo(s)
    .split("&amp;").join("&")
    .split("&lt;").join("<")
    .split("&gt;").join(">")
    .split("&quot;").join('"');
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, "");
}

function collapseWs(s) {
  return s.replace(/[ \t]*\r?\n[ \t]*/g, " ").replace(/[ \t]{2,}/g, " ").trim();
}

// Pull the inner content of every `et_pb_text_inner` that occurs before the first toggle —
// that's the episode intro summary (one or more <p>). Returns array of inner-HTML strings.
function introBlocks(html, entryStart, firstToggleIdx) {
  const region = html.slice(entryStart, firstToggleIdx);
  const re = /<div class="et_pb_text_inner">([\s\S]*?)<\/div>/g;
  const blocks = [];
  let m;
  while ((m = re.exec(region))) blocks.push(m[1].trim());
  return blocks;
}

// Credits toggle inner content (has <p>, <a>, <br>), preserved as HTML.
function creditsBlock(html) {
  const m = html.match(
    /et_pb_toggle_title">Credits<\/h[1-6]><div class="et_pb_toggle_content clearfix">([\s\S]*?)<\/div><\/div>/,
  );
  return m ? m[1].trim() : "";
}

// Normalize an HTML fragment for storage: keep <p>/<a>/<br>, decode typographic entities,
// drop stray attributes we don't want (keep href/target/rel on <a>), collapse whitespace.
function cleanBodyFragment(frag) {
  let f = frag;
  // normalize <br> variants
  f = f.replace(/<br\s*\/?>/gi, "<br />");
  // Strip Google-Docs paste noise: inline style= (incl. a hardcoded brand color that would
  // violate CLAUDE.md rule #5) and aria-level= attributes.
  f = f.replace(/\s+style="[^"]*"/gi, "");
  f = f.replace(/\s+aria-level="[^"]*"/gi, "");
  // Unwrap now-attribute-less <span> wrappers (purely cosmetic), keeping their text.
  f = f.replace(/<span>/gi, "").replace(/<\/span>/gi, "");
  f = decodeTypo(f);
  f = f.replace(/[ \t]*\r?\n[ \t]*/g, "\n").replace(/\n{2,}/g, "\n").trim();
  // Tidy any doubled spaces left behind by unwrapping.
  f = f.replace(/ {2,}/g, " ");
  return f;
}

// Extract the first paragraph's text from intro blocks (for excerpt).
function firstParagraphText(introHtmlBlocks) {
  const joined = introHtmlBlocks.join("\n");
  const m = joined.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  const inner = m ? m[1] : joined;
  return collapseWs(decodeAll(stripTags(inner)));
}

const result = {};
const preview = [];

for (const slug of SLUGS) {
  const html = readFileSync(join(TMP, "ep", `${slug}.html`), "utf8");
  const entryStart = html.indexOf('<div class="entry-content">');
  const firstToggleIdx = html.indexOf('et_pb_toggle_title">');
  if (entryStart < 0 || firstToggleIdx < 0) throw new Error(`markers not found for ${slug}`);

  const intros = introBlocks(html, entryStart, firstToggleIdx).filter(Boolean);
  if (!intros.length) throw new Error(`no intro text for ${slug}`);
  const credits = creditsBlock(html);
  if (!credits) throw new Error(`no credits for ${slug}`);

  const introClean = intros.map(cleanBodyFragment).join("\n");
  const creditsClean = cleanBodyFragment(credits);
  const body = `${introClean}\n<h2>Credits</h2>\n${creditsClean}`;
  const excerpt = firstParagraphText(intros);

  result[slug] = { body, excerpt };
  preview.push(
    `\n===== ${slug} =====\n--- EXCERPT (${excerpt.length} chars) ---\n${excerpt}\n--- BODY (${body.length} chars) ---\n${body}`,
  );
}

const outDir = join(here, "_generated");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "bodies.json"), JSON.stringify(result, null, 2), "utf8");
console.log(preview.join("\n"));
console.log(`\n\nWrote ${Object.keys(result).length} entries to ${join(outDir, "bodies.json")}`);
