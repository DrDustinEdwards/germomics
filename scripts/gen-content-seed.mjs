// Single source for the content-in-D1 seed. Run with: node scripts/gen-content-seed.mjs
// Emits BOTH:
//   drizzle/0005_content_settings.sql  (additive DDL + FTS + INSERT OR IGNORE seed)
//   app/lib/content-defaults.ts         (the same values as in-code fallbacks)
// so the D1 seed and the runtime fallbacks are guaranteed identical. Re-runnable: INSERT OR IGNORE
// never clobbers a row that has since been edited live. All copy obeys the no-em-dash rule.
import { writeFileSync } from "node:fs";

// ----- settings (key/value, instant) -----------------------------------------
const SYSTEM_BASE =
  "You are an editorial assistant for the germomics podcast (microbiology and history). " +
  "You write ONLY from the transcript provided in the user message. Never invent or infer " +
  "facts, names, dates, numbers, citations, quotes, or links that are not explicitly present " +
  "in the transcript. If something is not in the transcript, leave it out. Produce exactly what " +
  "is asked, with no preamble, apologies, or meta-commentary.";

const STYLE_RULE =
  "Writing style (strict): Do NOT use em dashes (the long dash character) anywhere; use commas, " +
  "periods, parentheses, or colons instead. Avoid AI-writing tells such as: delve, tapestry, " +
  "spans, landscape, realm, navigate, testament to, boasts, stands as, the phrasing 'not just X, " +
  "it's Y', overwrought three-item lists, and grandiose closing sentences. Write plain, direct, " +
  "varied, human sentences.";

const PROMPT_SHOWNOTES =
  "Write show notes for this episode as clean HTML, optimized to be quoted by search engines " +
  "and AI answer engines (answer-first). Structure:\n" +
  "1) ANSWER-FIRST opening <p>: a direct, self-contained 40 to 60 word answer to “what is this " +
  "episode about and what will I learn?”. State it plainly in the first sentence, with no preamble, " +
  "no “In this episode…” throat-clearing. This must stand alone as a quotable summary.\n" +
  "2) An <h2>Key topics</h2> followed by a <ul> of the main segments/topics actually discussed.\n" +
  "3) Only if specific works, people, or sources are explicitly named in the transcript, add " +
  "<h2>Mentioned</h2> and a <ul> listing them.\n" +
  "4) OPTIONAL <h2>FAQ</h2>: include ONLY if the transcript clearly answers common questions a " +
  "listener would ask. If so, add 2 to 5 pairs of <h3>question?</h3> immediately followed by a <p> " +
  "answer (50 words or fewer each), every answer grounded in the transcript. Omit the FAQ entirely if it " +
  "would be thin or speculative.\n" +
  "Use only these tags: <p>, <h2>, <h3>, <ul>, <li>, <strong>, <em>. Do not include <html>, " +
  "<body>, headings above <h2>, code fences, or any commentary. Invent nothing.";

const PROMPT_CHAPTERS =
  "From this WebVTT transcript, propose chapter markers at major topic shifts, using the actual " +
  "cue start times. Return ONLY a JSON array (no prose, no code fences) of 4 to 12 objects: " +
  '[{"startTime": <whole seconds, number>, "title": "<short title, 60 chars or fewer>"}]. ' +
  "The first startTime must be 0 and times must strictly increase. Title each chapter from what " +
  "is actually discussed; invent nothing.";

const PROMPT_SEO =
  "From the transcript below, write SEO metadata. Return ONLY JSON (no prose, no code fences): " +
  '{"seoTitle": "60 chars or fewer", "seoDescription": "155 chars or fewer", "socialBlurb": "200 chars or fewer, ' +
  'engaging, first-person plural voice"}. Ground every claim in the transcript; invent nothing.';

const settings = [
  ["site.tagline", "The purple stain, retold", "string", "site", "Site tagline", "Short hero eyebrow line."],
  ["site.base_url", "", "string", "site", "Canonical base URL", "Non-secret canonical/OG origin. Empty means use the request origin."],
  ["contact.address", JSON.stringify({ streetAddress: "Box T-0100", locality: "Stephenville", region: "TX", postalCode: "76402", country: "US" }), "json", "contact", "Postal address (structured)", "Used in schema.org PostalAddress."],
  ["contact.address_line", "Box T-0100, Stephenville, TX 76402", "string", "contact", "Postal address (one line)", "Shown on the privacy page and any newsletter footer."],
  ["social.twitter", "", "string", "social", "X / Twitter handle", "Optional. Leave blank to omit."],
  ["social.instagram", "", "string", "social", "Instagram handle", "Optional. Leave blank to omit."],
  ["ai.model", "claude-sonnet-4-6", "string", "ai", "AI model", "Anthropic model id for the authoring assists."],
  ["ai.daily_cap", "100", "number", "ai", "AI daily cap", "Max AI generations per day across the admin."],
  ["ratelimit.ai", "15", "number", "ratelimit", "Rate limit: /admin/ai", "Requests per minute per IP."],
  ["ratelimit.auth", "30", "number", "ratelimit", "Rate limit: /api/auth", "Requests per minute per IP."],
  ["ratelimit.admin", "150", "number", "ratelimit", "Rate limit: /admin", "Requests per minute per IP."],
  ["ai.prompt.system", SYSTEM_BASE, "markdown", "ai-prompts", "AI system prompt", "Base system prompt for all generators."],
  ["ai.prompt.style", STYLE_RULE, "markdown", "ai-prompts", "AI style rule", "House no-em-dash / no-AI-tells rule, appended to the system prompt."],
  ["ai.prompt.shownotes", PROMPT_SHOWNOTES, "markdown", "ai-prompts", "AI prompt: show notes", "Instruction for the show-notes generator (transcript appended at run time)."],
  ["ai.prompt.chapters", PROMPT_CHAPTERS, "markdown", "ai-prompts", "AI prompt: chapters", "Instruction for the chapters generator."],
  ["ai.prompt.seo", PROMPT_SEO, "markdown", "ai-prompts", "AI prompt: SEO", "Instruction for the SEO generator."],
];

// ----- snippets (content_blocks kind=snippet, instant) -----------------------
const CHOLERA = "John Snow's map of the Broad Street outbreak: deaths clustered around a single pump, the founding case of epidemiology and a Vibrio cholerae story.";
const FLU = "The three waves of the 1918 H1N1 pandemic: mortality peaked sharply in the deadly autumn wave, a defining example of viral pandemic dynamics.";

const snippets = [
  ["snippet:footer.tagline", "Footer tagline", "a microbiology & history podcast and writing project."],
  ["snippet:nav.episodes", "Nav: Episodes", "Episodes"],
  ["snippet:nav.writing", "Nav: Writing", "Writing"],
  ["snippet:nav.archive", "Nav: Archive", "Archive"],
  ["snippet:nav.data", "Nav: Data", "Data"],
  ["snippet:nav.games", "Nav: Games", "Games"],
  // nav.search/subscribe/about/privacy/terms ship via migration 0006 (0005 is already applied).
  ["snippet:nav.search", "Nav: Search", "Search"],
  ["snippet:nav.subscribe", "Nav: Subscribe", "Subscribe"],
  ["snippet:nav.about", "Nav: About", "About"],
  ["snippet:nav.privacy", "Nav: Privacy", "Privacy"],
  ["snippet:nav.terms", "Nav: Terms", "Terms"],
  ["snippet:empty.people", "Empty: people", "No people yet. Create one on the right."],
  ["snippet:empty.versions", "Empty: versions", "No saved versions yet. They are snapshotted on each save."],
  ["snippet:empty.scores", "Empty: scores", "No scores yet. Be the first."],
  ["snippet:meta.home_title", "Meta: home title", "germomics · microbiology & history"],
  ["snippet:meta.home_description", "Meta: home description", "A podcast and writing project about microbiology and history, with audio, transcripts, writing, data, and games."],
  ["snippet:meta.title_template", "Meta: title template", "{title} · germomics"],
  ["snippet:dataset.cholera-soho-1854", "Dataset: cholera", CHOLERA],
  ["snippet:dataset.influenza-1918", "Dataset: 1918 flu", FLU],
  ["snippet:ai.error.not_configured", "AI error: not configured", "AI is not configured. Set the ANTHROPIC_API_KEY worker secret."],
  ["snippet:ai.error.rate_limit", "AI error: rate limit", "AI rate limit hit. Wait a moment and try again."],
  ["snippet:ai.error.overloaded", "AI error: overloaded", "AI service is overloaded. Try again shortly."],
  ["snippet:ai.error.no_transcript", "AI error: no transcript", "This episode has no transcript yet. Add one first."],
  ["snippet:ai.error.daily_cap", "AI error: daily cap", "Daily AI limit reached. Try again tomorrow."],
];

// ----- pages (content_blocks kind=page, status=published) --------------------
const BIO =
  "Dr. Dustin Edwards is Professor and Department Head of Biological Sciences in the College of Science " +
  "and Mathematics at Tarleton State University. He chairs the Institutional Biosafety Committee at the " +
  "university, and he serves as an officer and the Archivist of the Texas Branch of the American Society " +
  "for Microbiology. He earned his Ph.D. in Biomedical Sciences from the Department of Molecular Virology " +
  "and Microbiology at Baylor College of Medicine within the Texas Medical Center in Houston, where he " +
  "studied how the human T-cell leukemia virus type 1 (HTLV-1) protein Tax disrupts the control of cell " +
  "growth. He then spent five years as a postdoctoral fellow at the National Cancer Institute, part of " +
  "the National Institutes of Health in Bethesda, Maryland, working on the regulatory and accessory " +
  "proteins that HTLV-1 uses to establish and maintain infection. His lab at Tarleton continues work on " +
  "retroviruses, including molecular studies and field surveillance for reticuloendotheliosis virus (REV) " +
  "and lymphoproliferative disease virus (LPDV) in wild turkeys and other Texas game birds. He also " +
  "oversees course-based undergraduate research on bacteriophages, viruses that infect bacteria, with the " +
  "Howard Hughes Medical Institute SEA program. Germomics began as a project for a Science and Society " +
  "course and is now an independent podcast and writing project about microbiology and history.";

const ABOUT_HTML =
  "<p>germomics is a podcast and writing project about microbiology and history.</p>" +
  "<p>germomics explores the microbial world and the people, places, and discoveries behind it: the organisms, the science, and the stories that shaped how we understand life too small to see.</p>" +
  "<p>Alongside the podcast there is writing, interactive data pages on viruses and bacteria, and short browser games, all made independently by a single author.</p>";

const PRIVACY_HTML = [
  "<p>germomics is an independent podcast and writing project run by a single author. This policy explains what personal data the site collects, why, and your choices. We collect as little as possible.</p>",
  "<h2>What we collect</h2>",
  "<ul>",
  "<li><strong>Newsletter email.</strong> If you subscribe, we store your email address, the time you gave consent, and an unsubscribe token. Nothing else.</li>",
  "<li><strong>Web analytics (cookieless).</strong> We use Cloudflare Web Analytics, which measures aggregate traffic without cookies and without tracking you across sites.</li>",
  "<li><strong>Podcast download analytics.</strong> Episode audio is served through OP3, an open, privacy-respecting analytics prefix that counts downloads. It processes request data such as IP address and app/user-agent to produce aggregate stats. It is not used to identify you.</li>",
  "<li><strong>On-device storage.</strong> Your theme choice and audio playback position are kept in your browser local storage and never sent to us.</li>",
  "<li><strong>Admin sign-in.</strong> The site single administrator signs in with Google (OAuth). This is not available to visitors and processes only the administrator account.</li>",
  "<li><strong>Server and security logs.</strong> Our host (Cloudflare) processes standard request data to deliver and protect the site.</li>",
  "</ul>",
  "<h2>How we use it</h2>",
  "<p>To send the newsletter you asked for, understand aggregate audience and download numbers, keep the site secure and working, and operate the admin tools. We do not sell your data or use it for cross-site advertising.</p>",
  "<h2>Legal bases (GDPR)</h2>",
  "<p>Newsletter email is processed on the basis of your consent. Security and aggregate analytics rely on our legitimate interests in running a safe, functional site.</p>",
  "<h2>Who we share it with</h2>",
  "<p>Service providers that make the site work: Cloudflare (hosting, storage, cookieless analytics), OP3 (download analytics), and Google (administrator sign-in only). Each processes data on our behalf under their own terms.</p>",
  "<h2>Your choices and rights</h2>",
  "<ul>",
  "<li>Unsubscribe anytime via the one-click link in every newsletter email.</li>",
  "<li>You may request access to, correction of, or deletion of your data, where applicable under GDPR/CCPA, by emailing us.</li>",
  "</ul>",
  "<h2>Retention</h2>",
  "<p>We keep your newsletter email until you unsubscribe (after which it is suppressed so we do not accidentally re-add you). Aggregate analytics are retained by our providers per their policies.</p>",
  "<h2>Children</h2>",
  "<p>The site is not directed to children under 13, and we do not knowingly collect their data.</p>",
  "<h2>Changes</h2>",
  "<p>We will update this page if our practices change, and revise the date above.</p>",
  "<h2>Contact</h2>",
  '<p>Questions or requests: <a href="mailto:{{email}}">{{email}}</a>.</p>',
  "<p>By post: {{address_line}}.</p>",
].join("");

const TERMS_HTML = [
  "<p>These terms govern your use of the germomics website, podcast, writing, data pages, and games (the site). By using the site you agree to them. If you do not agree, please do not use the site.</p>",
  "<h2>Content and intellectual property</h2>",
  '<p>Episodes, transcripts, writing, artwork, and other original material are the property of germomics and its author unless otherwise noted, and are provided for personal, non-commercial use. The podcast RSS feed may be used by podcast apps and directories in the normal way. You may quote and link to the site with attribution. AI and citation use is described in our <a href="/ai.txt">ai.txt</a> and <a href="/robots.txt">robots.txt</a>.</p>',
  "<h2>Your submissions</h2>",
  "<p>If you join the newsletter, you confirm the email address is yours and you consent to receive it. You can unsubscribe at any time. If you submit a game score or similar, do not include personal information or offensive content in any name field, and we may remove submissions that do.</p>",
  "<h2>Acceptable use</h2>",
  "<p>Do not attempt to disrupt, overload, probe, or gain unauthorized access to the site, and do not scrape it in ways that harm its operation. We use rate limiting and other protections.</p>",
  "<h2>Third-party links and services</h2>",
  '<p>The site links to and relies on third parties (podcast apps, Cloudflare, OP3, Google for admin sign-in). We are not responsible for third-party content or practices. See our <a href="/privacy">privacy policy</a>.</p>',
  "<h2>Disclaimer</h2>",
  "<p>The site is provided as is, without warranties of any kind. Content about microbiology and history is for general information and is not medical, scientific, or professional advice.</p>",
  "<h2>Limitation of liability</h2>",
  "<p>To the fullest extent permitted by law, germomics and its author are not liable for any indirect or consequential damages arising from your use of the site.</p>",
  "<h2>Changes</h2>",
  "<p>We may update these terms. Continued use after an update means you accept the new terms.</p>",
  "<h2>Governing law</h2>",
  "<p>These terms are governed by the laws of the site owner jurisdiction. [Placeholder: Dustin to specify jurisdiction.]</p>",
  "<h2>Contact</h2>",
  '<p>Questions: <a href="mailto:{{email}}">{{email}}</a>.</p>',
].join("");

const LLMS_INTRO =
  "germomics is a podcast and writing project about microbiology and history. This is a curated index " +
  "of the canonical hubs and key content for AI assistants and answer engines. Citation is welcome. " +
  "Please cite germomics and link the source URL.";

const AITXT_POLICY = [
  "# Citation and search (RAG, answer engines): ALLOWED.",
  "# Please cite the source and link the canonical URL.",
  "# Training data: rights reserved (opt-out). Contact for licensing in the address below.",
].join("\n");

const pages = [
  ["page:about", "About germomics", ABOUT_HTML],
  ["page:dustin-edwards", "Dr. Dustin Edwards", "<p>" + BIO + "</p>"],
  ["page:privacy", "Privacy policy", PRIVACY_HTML],
  ["page:terms", "Terms of use", TERMS_HTML],
  ["page:llms", "llms.txt intro", LLMS_INTRO],
  ["page:ai-txt", "ai.txt policy", AITXT_POLICY],
];

// ----- emit ------------------------------------------------------------------
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

let sql = `-- 0005_content_settings.sql - content + config in D1 (AI-editable). ADDITIVE.
-- Generated by scripts/gen-content-seed.mjs (single source for seed + app/lib/content-defaults.ts).
-- Two tables + an FTS5 mirror of content_blocks. Seed is INSERT OR IGNORE so re-applying never
-- clobbers values edited live. show_config stays the feed's source of truth and is not touched.

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'string' CHECK (type IN ('string','number','json','markdown')),
  "group" TEXT,
  label TEXT,
  description TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS content_blocks (
  key TEXT PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'snippet' CHECK (kind IN ('page','snippet')),
  title TEXT,
  value TEXT NOT NULL DEFAULT '',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS content_blocks_kind_idx ON content_blocks (kind, status);

-- External-content FTS5 mirror of content_blocks(title, value), kept in sync by triggers, so site
-- search and raw SQL both reach every word.
CREATE VIRTUAL TABLE IF NOT EXISTS content_blocks_fts USING fts5(title, value, content='content_blocks', content_rowid='rowid');

CREATE TRIGGER IF NOT EXISTS content_blocks_ai AFTER INSERT ON content_blocks BEGIN
  INSERT INTO content_blocks_fts(rowid, title, value) VALUES (new.rowid, new.title, new.value);
END;
CREATE TRIGGER IF NOT EXISTS content_blocks_au AFTER UPDATE ON content_blocks BEGIN
  INSERT INTO content_blocks_fts(content_blocks_fts, rowid, title, value) VALUES('delete', old.rowid, old.title, old.value);
  INSERT INTO content_blocks_fts(rowid, title, value) VALUES (new.rowid, new.title, new.value);
END;
CREATE TRIGGER IF NOT EXISTS content_blocks_ad AFTER DELETE ON content_blocks BEGIN
  INSERT INTO content_blocks_fts(content_blocks_fts, rowid, title, value) VALUES('delete', old.rowid, old.title, old.value);
END;

`;

for (const [key, value, type, group, label, description] of settings) {
  sql += `INSERT OR IGNORE INTO settings (key, value, type, "group", label, description) VALUES (${q(key)}, ${q(value)}, ${q(type)}, ${q(group)}, ${q(label)}, ${q(description)});\n`;
}
sql += "\n";
for (const [key, title, value] of snippets) {
  sql += `INSERT OR IGNORE INTO content_blocks (key, kind, title, value, status) VALUES (${q(key)}, 'snippet', ${q(title)}, ${q(value)}, 'published');\n`;
}
sql += "\n";
for (const [key, title, value] of pages) {
  sql += `INSERT OR IGNORE INTO content_blocks (key, kind, title, value, status) VALUES (${q(key)}, 'page', ${q(title)}, ${q(value)}, 'published');\n`;
}

writeFileSync("drizzle/0005_content_settings.sql", sql);

// content-defaults.ts (runtime fallbacks, identical values)
const settingObj = Object.fromEntries(settings.map(([k, v]) => [k, v]));
const snippetObj = Object.fromEntries(snippets.map(([k, , v]) => [k, v]));
const pageObj = Object.fromEntries(pages.map(([k, title, value]) => [k, { title, value }]));

const ts = `// AUTO-GENERATED by scripts/gen-content-seed.mjs - do not edit by hand.
// In-code fallbacks for the content-in-D1 layer: every read falls back to these, so a missing
// row never breaks a page. Identical to the migration 0005 seed.

export const SETTING_DEFAULTS: Record<string, string> = ${JSON.stringify(settingObj, null, 2)};

export const SNIPPET_DEFAULTS: Record<string, string> = ${JSON.stringify(snippetObj, null, 2)};

export const PAGE_DEFAULTS: Record<string, { title: string; value: string }> = ${JSON.stringify(pageObj, null, 2)};
`;

writeFileSync("app/lib/content-defaults.ts", ts);
console.log("Wrote drizzle/0005_content_settings.sql and app/lib/content-defaults.ts");
console.log(`settings=${settings.length} snippets=${snippets.length} pages=${pages.length}`);
