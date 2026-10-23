// One-off catalog migration: generate idempotent UPSERT SQL for the 10 legacy podcast
// episodes, using the repo's Drizzle schema + query builder so column names come from the
// single source of truth (app/db/schema.ts). The SQL is APPLIED natively with
// `wrangler d1 execute germomics --remote --file` — never an HTTP D1 driver (CLAUDE.md rule #1).
//
// Field sources:
//   - guid / enclosure / byte length / duration / pubDate / episode number  <- the feed (exact)
//   - body    <- scraped season-1 page: intro summary + Credits (scripts/_generated/bodies.json)
//   - excerpt <- scraped season-1 page: rich intro summary (NOT the old one-line <description>)
//
// Idempotent: upsert keyed on posts.guid. The conflict-update set deliberately OMITS `transcript`
// so the VTT written by import-transcripts.ts survives a re-run of this script.
//
// Run:  node scripts/import-episodes.ts   (writes scripts/_generated/episodes.sql)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { sql } from "drizzle-orm";
import { posts } from "../app/db/schema.ts";

const here = dirname(fileURLToPath(import.meta.url));

// Query builder against the real schema; .toSQL() never executes, so the driver is a no-op.
const db = drizzle(async () => ({ rows: [] }));

// body + excerpt scraped from the season-1 episode pages.
const BODIES: Record<string, { body: string; excerpt: string }> = JSON.parse(
  readFileSync(join(here, "_generated", "bodies.json"), "utf8"),
);

// Technical fields parsed from https://germomics.com/feed/podcast/ (the source of truth).
// pubDate stored ISO-UTC so rfc822() and formatDate() parse it (they require a 'T').
type Ep = {
  guid: string;
  slug: string; // == legacy WordPress permalink == feed <link> slug
  title: string; // decoded; curly apostrophe (U+2019) preserved from the feed
  file: string;
  bytes: number;
  duration: number; // seconds (from feed MM:SS)
  publishedAt: string; // ISO-UTC
  episodeNumber: number;
};

const EPISODES: Ep[] = [
  { guid: "https://germomics.com/?p=163", slug: "a-sky-full-of-sars", title: "A Sky Full of SARS", file: "Podcast_001_A_Sky_Full_of_SARS.mp3", bytes: 33379711, duration: 34 * 60 + 46, publishedAt: "2019-09-03T09:00:50.000Z", episodeNumber: 1 },
  { guid: "https://germomics.com/?p=219", slug: "on-the-right-taq", title: "On the Right Taq", file: "Podcast_002_On_the_Right_Taq.mp3", bytes: 19396797, duration: 20 * 60 + 12, publishedAt: "2019-09-10T09:00:34.000Z", episodeNumber: 2 },
  { guid: "https://germomics.com/?p=311", slug: "confessions-of-a-cholera-girl", title: "Confessions of a Cholera Girl", file: "Podcast_003_Confessions_of_a_Cholera_Girl.mp3", bytes: 42600951, duration: 44 * 60 + 4, publishedAt: "2019-09-17T09:00:53.000Z", episodeNumber: 3 },
  { guid: "https://germomics.com/?p=428", slug: "one-flew-over-the-kuru-nest", title: "One Flew Over The Kuru Nest", file: "Podcast_004_One_Flew_Over_the_Kuru_Nest.mp3", bytes: 28185956, duration: 29 * 60 + 3, publishedAt: "2019-09-24T09:00:33.000Z", episodeNumber: 4 },
  { guid: "https://germomics.com/?p=461", slug: "its-on-the-syphilis", title: "It’s On The Syphilis", file: "Podcast_005_Its_on_the_Syphilis.mp3", bytes: 22509761, duration: 23 * 60 + 27, publishedAt: "2019-10-01T09:00:20.000Z", episodeNumber: 5 },
  { guid: "https://germomics.com/?p=493", slug: "theres-something-about-typhoid-mary", title: "There’s Something About Typhoid Mary", file: "Podcast_006_Theres_Something_About_Typhoid_Mary.mp3", bytes: 23919429, duration: 24 * 60 + 37, publishedAt: "2019-10-08T09:00:46.000Z", episodeNumber: 6 },
  { guid: "https://germomics.com/?p=513", slug: "a-boy-named-flu", title: "A Boy Named Flu", file: "Podcast_007_A_Boy_Named_Flu.mp3", bytes: 20448278, duration: 21 * 60 + 0, publishedAt: "2019-10-22T09:00:48.000Z", episodeNumber: 7 },
  { guid: "https://germomics.com/?p=530", slug: "rabies-day-out", title: "Rabies Day Out", file: "Podcast_008_Rabies_Day_Out.mp3", bytes: 24840611, duration: 25 * 60 + 34, publishedAt: "2019-10-31T09:00:41.000Z", episodeNumber: 8 },
  { guid: "https://germomics.com/?p=560", slug: "hell-on-weils", title: "Hell on Weils", file: "Podcast_009_Hell_on_Weils.mp3", bytes: 12859930, duration: 13 * 60 + 24, publishedAt: "2019-11-07T07:30:42.000Z", episodeNumber: 9 },
  { guid: "https://germomics.com/?p=563", slug: "antitoxin-togo-please", title: "Antitoxin Togo, Please", file: "Podcast_010_Antitoxin_Togo_Please.mp3", bytes: 20724967, duration: 21 * 60 + 17, publishedAt: "2019-11-19T09:00:30.000Z", episodeNumber: 10 },
];

// Inline a Drizzle .toSQL() param as a SQL literal (we apply via wrangler, no bound params).
function lit(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function buildStatement(e: Ep): string {
  const content = BODIES[e.slug];
  if (!content) throw new Error(`no scraped body/excerpt for ${e.slug}`);

  const row = {
    kind: "episode" as const,
    title: e.title,
    slug: e.slug,
    body: content.body,
    excerpt: content.excerpt,
    status: "published" as const,
    publishedAt: e.publishedAt,
    audioUrl: `https://media.germomics.com/${e.file}`,
    audioDuration: e.duration,
    audioByteSize: e.bytes,
    audioMimeType: "audio/mpeg",
    episodeNumber: e.episodeNumber,
    seasonNumber: 1,
    episodeType: "full" as const,
    explicit: false,
    guid: e.guid,
  };

  const q = db
    .insert(posts)
    .values(row)
    .onConflictDoUpdate({
      target: posts.guid,
      // Reference excluded.<col> rather than re-inlining values — keeps the statement small
      // (D1 caps single-statement SQL length) and is the canonical upsert pattern. `transcript`
      // is intentionally omitted so a VTT written by import-transcripts.ts survives a re-run.
      set: {
        kind: sql`excluded.kind`,
        title: sql`excluded.title`,
        slug: sql`excluded.slug`,
        body: sql`excluded.body`,
        excerpt: sql`excluded.excerpt`,
        status: sql`excluded.status`,
        publishedAt: sql`excluded.published_at`,
        audioUrl: sql`excluded.audio_url`,
        audioDuration: sql`excluded.audio_duration`,
        audioByteSize: sql`excluded.audio_byte_size`,
        audioMimeType: sql`excluded.audio_mime_type`,
        episodeNumber: sql`excluded.episode_number`,
        seasonNumber: sql`excluded.season_number`,
        episodeType: sql`excluded.episode_type`,
        explicit: sql`excluded.explicit`,
        updatedAt: sql`(datetime('now'))`,
      },
    });

  const { sql: text, params } = q.toSQL();
  let i = 0;
  const inlined = text.replace(/\?/g, () => lit(params[i++]));
  if (i !== params.length) throw new Error(`param count mismatch for ${e.guid}`);
  return inlined + ";";
}

const statements = EPISODES.map(buildStatement);
const out =
  "-- GENERATED by scripts/import-episodes.ts — do not edit by hand.\n" +
  "-- Idempotent UPSERT of the 10 legacy episodes, keyed on posts.guid.\n" +
  statements.join("\n") +
  "\n";

const outPath = join(here, "_generated", "episodes.sql");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, out, "utf8");
console.log(`Wrote ${statements.length} statements to ${outPath} (${out.length} bytes)`);
