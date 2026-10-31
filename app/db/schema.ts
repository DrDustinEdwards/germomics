// app/db/schema.ts — germomics data model (Drizzle ORM, Cloudflare D1 / SQLite).
//
// Three blocks:
//   1. Content      — posts / post_versions / show_config (already live in D1; copied
//                     verbatim from the provided docs/schema.ts, the framework-agnostic source).
//   2. (retired)    Better Auth's user / session / account / verification, dropped by
//                     drizzle/0010_retire_better_auth.sql after the move to Cloudflare Access.
//   3. App          — scores (game leaderboards) + subscribers (newsletter), additive tables.
//
// FTS5 (posts_fts + sync triggers) is not expressible in Drizzle's DSL and lives in the raw
// migration drizzle/0000_content_and_fts.sql. Query with:
//   SELECT p.* FROM posts_fts f JOIN posts p ON p.id = f.rowid WHERE posts_fts MATCH ?

import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql, relations } from "drizzle-orm";
// JSON shapes (stored as TEXT, typed at the edge). Defined client-safe in lib/types and
// re-exported here so loaders and components share one source of truth.
import type { BodyMeta, Chapter, Guest, Host, KeyMoment, PersonLink, PodcastCategory, Source } from "~/lib/types";
export type { BodyMeta, Chapter, Guest, Host, KeyMoment, PersonLink, PodcastCategory, Source };

// ============================================================
// 1. Content (live)
// ============================================================
export const posts = sqliteTable(
  "posts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind", { enum: ["episode", "article"] })
      .notNull()
      .default("article"),

    // shared base
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    body: text("body").notNull().default(""),
    excerpt: text("excerpt"),
    coverImage: text("cover_image"),
    tags: text("tags", { mode: "json" }).$type<string[]>().default(sql`'[]'`),
    status: text("status", { enum: ["draft", "published"] })
      .notNull()
      .default("draft"),
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    publishedAt: text("published_at"),
    // Scheduling gate (0002): a "scheduled" post is status=published with a future publishAt;
    // public reads hide published posts whose publishAt is still in the future.
    publishAt: text("publish_at"),
    // Per-post social image + alt text for accessible images (0002).
    coverAlt: text("cover_alt"),
    ogImage: text("og_image"),
    ogImageAlt: text("og_image_alt"),
    // site-api's canonical and noindex search fields (0021).
    canonical: text("canonical"),
    noindex: integer("noindex", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),

    // episode only (null for articles)
    audioUrl: text("audio_url"),
    audioDuration: integer("audio_duration"),
    audioByteSize: integer("audio_byte_size"),
    audioMimeType: text("audio_mime_type").default("audio/mpeg"),
    episodeNumber: integer("episode_number"),
    seasonNumber: integer("season_number"),
    episodeType: text("episode_type", { enum: ["full", "trailer", "bonus"] }).default(
      "full",
    ),
    explicit: integer("explicit", { mode: "boolean" }).default(false),
    guid: text("guid"),
    transcript: text("transcript"),
    chapters: text("chapters", { mode: "json" }).$type<Chapter[]>(),
    guests: text("guests", { mode: "json" }).$type<Guest[]>(), // legacy/raw-JSON fallback; people[] preferred
    episodeArtwork: text("episode_artwork"),
    episodeArtworkAlt: text("episode_artwork_alt"),
    audioPeaks: text("audio_peaks", { mode: "json" }).$type<number[]>(), // waveform: ints 0..100, len 400

    // 0009: editorial extras for the redesigned episode page.
    sources: text("sources", { mode: "json" }).$type<Source[]>(), // references/credits + image credits
    keyMoments: text("key_moments", { mode: "json" }).$type<KeyMoment[]>(), // "In this episode"
    readingTime: integer("reading_time"), // minutes, computed from body at save

    // 0016: body is Markdown; beside it, Prelum's render of it and the RENDER_VERSION it was rendered with
    // (app/lib/render.server.ts). A NULL renderVersion is a row not converted yet, whose body is still HTML.
    bodyHtml: text("body_html"),
    bodyMeta: text("body_meta", { mode: "json" }).$type<BodyMeta>(),
    renderVersion: text("render_version"),

    // 0019: Carrel's trash (when the post was trashed) and the change that scheduled a post not yet live.
    trashedAt: text("trashed_at"),
    scheduleChangeId: text("schedule_change_id"),

    // 0022: site-api's post fields: the post's own credit (null: the show's author), and its series and place in it.
    authors: text("authors", { mode: "json" }).$type<string[]>(),
    series: text("series"),
    seriesPart: integer("series_part"),
  },
  (t) => ({
    slugIdx: uniqueIndex("posts_slug_idx").on(t.slug),
    guidIdx: uniqueIndex("posts_guid_idx").on(t.guid),
    feedIdx: index("posts_feed_idx").on(t.kind, t.status, t.publishedAt),
  }),
);

export const postVersions = sqliteTable(
  "post_versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    snapshot: text("snapshot", { mode: "json" }).notNull(),
    // 0022: the change it was taken before, and by whom.
    event: text("event"),
    author: text("author"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ postIdx: index("post_versions_post_idx").on(t.postId) }),
);

export const showConfig = sqliteTable("show_config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  author: text("author").notNull(),
  ownerEmail: text("owner_email").notNull(),
  artwork: text("artwork").notNull(),
  appleCategory: text("apple_category").notNull(),
  language: text("language").notNull().default("en-us"),
  itunesType: text("itunes_type", { enum: ["episodic", "serial"] })
    .notNull()
    .default("episodic"),
  explicit: integer("explicit", { mode: "boolean" }).notNull().default(false),
  subscribeLinks: text("subscribe_links", { mode: "json" }).$type<
    Record<string, string>
  >(),
  fundingUrl: text("funding_url"),
  // Tier 2 (0003): up to 3 nested iTunes categories + an optional funding label.
  categories: text("categories", { mode: "json" })
    .$type<PodcastCategory[]>()
    .default(sql`'[]'`),
  fundingLabel: text("funding_label"),
  // 0009: show-level hosts byline (co-hosts). Maps to <podcast:person> alongside per-episode guests.
  hosts: text("hosts", { mode: "json" }).$type<Host[]>(),
});

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type ShowConfig = typeof showConfig.$inferSelect;

// ============================================================
// 3. App tables (additive — leaderboards + newsletter)
// ============================================================
// Public write endpoint feeds this; the action validates/clamps score and sanitizes name.
export const scores = sqliteTable(
  "scores",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    gameSlug: text("game_slug").notNull(),
    name: text("name").notNull(),
    score: integer("score").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ boardIdx: index("scores_board_idx").on(t.gameSlug, t.score) }),
);

// Newsletter capture: email + timestamp, unique on email. No other PII. (0004) adds explicit
// consent + tokenized one-click unsubscribe — still no PII beyond the email itself.
export const subscribers = sqliteTable(
  "subscribers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    // GDPR: timestamp the subscriber ticked the explicit consent box. NULL = legacy/implied.
    consentedAt: text("consented_at"),
    // One-click unsubscribe (RFC 8058 / tokenized link). Unguessable, unique, backfilled in 0004.
    unsubscribeToken: text("unsubscribe_token"),
    // Suppression timestamp — set when the subscriber unsubscribes (kept, not deleted, so a
    // re-signup with the same email doesn't silently resurrect a prior unsubscribe).
    unsubscribedAt: text("unsubscribed_at"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    emailIdx: uniqueIndex("subscribers_email_idx").on(t.email),
    tokenIdx: uniqueIndex("subscribers_token_idx").on(t.unsubscribeToken),
  }),
);

export type Score = typeof scores.$inferSelect;

// ============================================================
// 3b. Content-in-D1 (0005) — settings (config) + content_blocks (prose). AI-editable.
// ============================================================
// Non-secret config + operational values. show_config stays the feed's source of truth; settings
// never duplicates a show_config fact.
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  type: text("type", { enum: ["string", "number", "json", "markdown"] })
    .notNull()
    .default("string"),
  group: text("group"),
  label: text("label"),
  description: text("description"),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Prose: pages get a draft/published gate (only published renders publicly); snippets are instant.
// FTS (content_blocks_fts + triggers) lives in the raw migration drizzle/0005_content_settings.sql.
export const contentBlocks = sqliteTable(
  "content_blocks",
  {
    key: text("key").primaryKey(),
    kind: text("kind", { enum: ["page", "snippet"] }).notNull().default("snippet"),
    title: text("title"),
    value: text("value").notNull().default(""),
    description: text("description"),
    status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
    // 0016: a page's value is Markdown, rendered as posts' bodies are (NULL renderVersion: still HTML).
    bodyHtml: text("body_html"),
    renderVersion: text("render_version"),
  },
  (t) => ({ kindIdx: index("content_blocks_kind_idx").on(t.kind, t.status) }),
);

// 0022: a Markdown page's history, as post_versions is a post's: the block before each Carrel write.
export const contentBlockVersions = sqliteTable(
  "content_block_versions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    blockKey: text("block_key").notNull(),
    snapshot: text("snapshot", { mode: "json" }).notNull(),
    event: text("event"),
    author: text("author"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ keyIdx: index("content_block_versions_key_idx").on(t.blockKey) }),
);

export type Setting = typeof settings.$inferSelect;
export type ContentBlock = typeof contentBlocks.$inferSelect;

// ============================================================
// 4. People (reusable guest entities) + episode links + soundbites (0002)
// ============================================================
export const people = sqliteTable(
  "people",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    role: text("role"),
    bio: text("bio"),
    photo: text("photo"),
    photoAlt: text("photo_alt"),
    links: text("links", { mode: "json" }).$type<PersonLink[]>().default(sql`'[]'`),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ slugIdx: uniqueIndex("people_slug_idx").on(t.slug) }),
);

export const episodePeople = sqliteTable(
  "episode_people",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    personId: integer("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    role: text("role"),
    sort: integer("sort").notNull().default(0),
  },
  (t) => ({
    uniq: uniqueIndex("episode_people_uniq").on(t.postId, t.personId),
    postIdx: index("episode_people_post_idx").on(t.postId),
  }),
);

// Schema only this pass — the soundbite editor is deferred (Tier 2/3).
export const soundbites = sqliteTable(
  "soundbites",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    postId: integer("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    startSeconds: integer("start_seconds").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    title: text("title"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ postIdx: index("soundbites_post_idx").on(t.postId) }),
);

export const peopleRelations = relations(people, ({ many }) => ({
  episodes: many(episodePeople),
}));
export const episodePeopleRelations = relations(episodePeople, ({ one }) => ({
  post: one(posts, { fields: [episodePeople.postId], references: [posts.id] }),
  person: one(people, { fields: [episodePeople.personId], references: [people.id] }),
}));

export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
export type EpisodePerson = typeof episodePeople.$inferSelect;
export type Soundbite = typeof soundbites.$inferSelect;

// 0013: an update Carrel scheduled on a live article (site-api v0.10.0). Read and written only through
// @dustinedwards/site-api/schedules (app/lib/carrel/adapter.server.ts); declared here so the schema test sees it.
export const scheduledUpdates = sqliteTable(
  "scheduled_updates",
  {
    contentId: text("content_id").primaryKey(),
    source: text("source").notNull(),
    publishAt: text("publish_at").notNull(),
    changeId: text("change_id").notNull(),
    scheduledAt: text("scheduled_at").notNull(),
  },
  (t) => ({ dueIdx: index("scheduled_updates_due").on(t.publishAt) }),
);

// 0019: a renamed post's old slug, which redirects (301) to the post's slug now (app/lib/posts.server.ts).
export const postRedirects = sqliteTable("post_redirects", {
  fromSlug: text("from_slug").primaryKey(),
  postId: integer("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// 0018: site-api's store (safe retries, hook retries, preview links, the webmentions sent). Read and written only
// through @dustinedwards/site-api/store (app/lib/carrel/handler.server.ts); declared here so the schema test sees it.
export const siteApiWrites = sqliteTable(
  "site_api_writes",
  {
    changeId: text("change_id").primaryKey(),
    route: text("route").notNull(),
    requestHash: text("request_hash").notNull(),
    status: integer("status"),
    response: text("response"),
    state: text("state").notNull(),
    at: text("at").notNull(),
  },
  (t) => ({ atIdx: index("site_api_writes_at").on(t.at) }),
);

export const hookRetries = sqliteTable(
  "hook_retries",
  {
    id: text("id").primaryKey(),
    hook: text("hook").notNull(),
    event: text("event").notNull(),
    attempts: integer("attempts").notNull(),
    nextAt: text("next_at").notNull(),
    lastError: text("last_error").notNull(),
  },
  (t) => ({ dueIdx: index("hook_retries_due").on(t.nextAt) }),
);

export const previewLinks = sqliteTable(
  "preview_links",
  {
    tokenHash: text("token_hash").primaryKey(),
    contentId: text("content_id").notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at"),
    changeId: text("change_id").notNull(),
  },
  (t) => ({ contentIdx: index("preview_links_content").on(t.contentId, t.expiresAt) }),
);

export const webmentionTargets = sqliteTable("webmention_targets", {
  source: text("source").primaryKey(),
  targets: text("targets").notNull(),
  sentAt: text("sent_at").notNull(),
});

// 0014: the caption Carrel set on an image in BLOG_IMAGES, keyed by its R2 key. Since 0015 a caption lives on its
// `media` row; this table is read only by the backfill that made those rows (app/lib/media/backfill.server.ts).
export const mediaCaptions = sqliteTable("media_captions", {
  mediaKey: text("media_key").primaryKey(),
  caption: text("caption").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// 0015: the media library (site-api v0.13.1): one row per image in BLOG_IMAGES, its byte history and a change log
// (filled by triggers in the migration). Read and written through app/lib/media/store.server.ts.
export const media = sqliteTable(
  "media",
  {
    key: text("key").primaryKey(),
    filename: text("filename"),
    contentType: text("content_type").notNull(),
    bytes: integer("bytes").notNull().default(0),
    width: integer("width"),
    height: integer("height"),
    alt: text("alt").notNull().default(""),
    caption: text("caption").notNull().default(""),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    focus: text("focus"),
    credit: text("credit").notNull().default(""),
    license: text("license").notNull().default(""),
    sourceUrl: text("source_url"),
    licenseExpires: text("license_expires"),
    takenAt: text("taken_at"),
    sha256: text("sha256"),
    // prepareUpload's blurred data: URI and #rrggbb (0016); null for files stored before, or one the binding cannot read.
    placeholder: text("placeholder"),
    color: text("color"),
    trashedAt: text("trashed_at"),
    rev: integer("rev").notNull().default(0),
    uploadedAt: text("uploaded_at").notNull(),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ shaIdx: index("media_sha256_idx").on(t.sha256) }),
);

export const mediaRevisions = sqliteTable(
  "media_revisions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mediaKey: text("media_key").notNull(),
    at: text("at").notNull(),
    bytes: integer("bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    reason: text("reason", { enum: ["upload", "import", "replace", "transform", "resize", "revert"] }).notNull(),
    sha256: text("sha256"),
    backupKey: text("backup_key"),
  },
  (t) => ({ keyIdx: index("media_revisions_key_idx").on(t.mediaKey, t.id) }),
);

export const mediaChanges = sqliteTable(
  "media_changes",
  {
    seq: integer("seq").primaryKey({ autoIncrement: true }),
    mediaKey: text("media_key").notNull(),
    at: text("at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ keyIdx: index("media_changes_key_idx").on(t.mediaKey, t.seq) }),
);

export type MediaRow = typeof media.$inferSelect;
export type MediaRevisionRow = typeof mediaRevisions.$inferSelect;

// site-runtime's operations tables (drizzle/0017_ops.sql), written and read only through ./cron and ./not-found; here so
// the schema test holds them in step with the migration.
export const cronRuns = sqliteTable("cron_runs", {
  name: text("name").primaryKey(),
  everyMinutes: integer("every_minutes").notNull(),
  firstStartedAt: integer("first_started_at"),
  lastStartedAt: integer("last_started_at"),
  lastOkAt: integer("last_ok_at"),
  lastFailedAt: integer("last_failed_at"),
  lastError: text("last_error"),
});

export const page404Daily = sqliteTable(
  "page_404_daily",
  {
    id: text("id").primaryKey(),
    day: integer("day").notNull(),
    path: text("path").notNull(),
    referrerHost: text("referrer_host").notNull().default(""),
    kind: text("kind").notNull().default("page"),
    hitCount: integer("hit_count").notNull().default(0),
  },
  (t) => ({ dayPathReferrerIdx: uniqueIndex("page_404_daily_day_path_referrer_uq").on(t.day, t.path, t.referrerHost) }),
);
