// db/schema.ts germomics data model (Drizzle ORM, Cloudflare D1 / SQLite)
// One content table. kind drives every listing, filter, and feed.

import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// JSON shapes (stored as TEXT, typed at the edge)
export type Chapter = { start: number; title: string; img?: string; url?: string };
export type Guest = { name: string; role?: string; bio?: string; link?: string; img?: string };

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  kind: text('kind', { enum: ['episode', 'article'] }).notNull().default('article'),

  // shared base
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  body: text('body').notNull().default(''),
  excerpt: text('excerpt'),
  coverImage: text('cover_image'),
  tags: text('tags', { mode: 'json' }).$type<string[]>().default(sql`'[]'`),
  status: text('status', { enum: ['draft', 'published'] }).notNull().default('draft'),
  featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  publishedAt: text('published_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),

  // episode only (null for articles)
  audioUrl: text('audio_url'),
  audioDuration: integer('audio_duration'),
  audioByteSize: integer('audio_byte_size'),
  audioMimeType: text('audio_mime_type').default('audio/mpeg'),
  episodeNumber: integer('episode_number'),
  seasonNumber: integer('season_number'),
  episodeType: text('episode_type', { enum: ['full', 'trailer', 'bonus'] }).default('full'),
  explicit: integer('explicit', { mode: 'boolean' }).default(false),
  guid: text('guid'),
  transcript: text('transcript'),
  chapters: text('chapters', { mode: 'json' }).$type<Chapter[]>(),
  guests: text('guests', { mode: 'json' }).$type<Guest[]>(),
  episodeArtwork: text('episode_artwork'),
}, (t) => ({
  slugIdx: uniqueIndex('posts_slug_idx').on(t.slug),
  guidIdx: uniqueIndex('posts_guid_idx').on(t.guid),
  feedIdx: index('posts_feed_idx').on(t.kind, t.status, t.publishedAt),
}));

export const postVersions = sqliteTable('post_versions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  postId: integer('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  snapshot: text('snapshot', { mode: 'json' }).notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (t) => ({ postIdx: index('post_versions_post_idx').on(t.postId) }));

export const showConfig = sqliteTable('show_config', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description').notNull(),
  author: text('author').notNull(),
  ownerEmail: text('owner_email').notNull(),
  artwork: text('artwork').notNull(),
  appleCategory: text('apple_category').notNull(),
  language: text('language').notNull().default('en-us'),
  itunesType: text('itunes_type', { enum: ['episodic', 'serial'] }).notNull().default('episodic'),
  explicit: integer('explicit', { mode: 'boolean' }).notNull().default(false),
  subscribeLinks: text('subscribe_links', { mode: 'json' }).$type<Record<string, string>>(),
  fundingUrl: text('funding_url'),
});

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

// FTS5 is not expressible in Drizzle's schema DSL. It is already applied live to D1 as a
// raw migration (see db/schema.sql): a posts_fts virtual table with content='posts' plus
// AFTER INSERT, UPDATE, DELETE triggers keeping it in sync. Query with:
//   SELECT p.* FROM posts_fts f JOIN posts p ON p.id = f.rowid WHERE posts_fts MATCH ?
