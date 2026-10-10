---
paths:
  - "app/db/**/*.ts"
  - "app/lib/posts.server.ts"
  - "app/routes/$slug.tsx"
  - "app/routes/episodes*.tsx"
  - "app/routes/writing*.tsx"
  - "app/routes/admin*.tsx"
---

# Content model (key columns)

The episode/article row (`posts`) and the single `show_config` row carry a few JSON columns worth knowing.

- `posts.sources` (JSON `Source[]`): the references and credits block, including image credits (`type:"image"`). One column, not a table. Figures themselves live in the body HTML.
- `posts.key_moments` (JSON `KeyMoment[]`, `{seconds,label}`): the curated, scannable "In this episode" list. Editorially distinct from `chapters` (player segments). Render key moments if present, else fall back to chapters; both seek the player.
- `posts.reading_time` (INTEGER minutes): computed from the body at save, so listing cards show it without loading the body.
- `show_config.hosts` (JSON `Host[]`, `{name,role,img,href}`): the show-level co-host byline. Per-episode `guests` stay on the post. Both map to `<podcast:person>` in the feed.
- `posts.audio_peaks` (JSON, the waveform contract): a fixed-length array of N=400 integers 0..100, each the normalized peak amplitude of one equal time-slice, scaled so the loudest slice is 100. Computed client-side in the admin browser at upload (`decodeAudioData` then the shared `app/lib/peaks.ts` bucketer); the 10 migrated episodes were backfilled once via `scripts/backfill-peaks.mjs`. Never decode audio in the Worker. The renderer divides by 100 and downsamples to its bar count (never upsamples), and falls back to a synthetic pattern when the value is null or malformed.

## Listing projection

Listing loaders use the `cardColumns` projection in `posts.server.ts`, which omits the heavy detail-only fields (`body`, `transcript`, `audio_peaks`, `sources`, `key_moments`). Only the single episode/article route and the readers that print the body or point at the transcript load full rows: the feeds and llms-full.txt use `listFullPosts` (guarded by `test/feeds.test.ts`).

## Migrated content

Never edit already-migrated post or episode content in D1 to satisfy a style rule. Historical content is left alone.
