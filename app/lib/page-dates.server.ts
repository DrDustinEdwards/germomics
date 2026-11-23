import { kvPageRecord, trackRenderedPageDates } from "@drdustinedwards/site-helpers/lastmod";
import { SITE_ORIGIN } from "~/lib/site";
import { listSeasons } from "~/lib/posts.server";
import { listDatasets } from "~/lib/datasets.server";
import { listGames } from "~/lib/games.server";

// The day each hub and static page of /sitemap.xml last changed. No row dates these pages (the episode list, the data
// pages, the policies), so the daily page-dates job reads each as Markdown, the way a Markdown copy is made, with
// Prelum's trackPageDates, and keeps the day its text last changed in one KV key. The sitemap reads it back.
export const PAGE_DATES_KEY = "sitemap:page-dates";

export const STATIC_PATHS = [
  "",
  "episodes",
  "writing",
  "archive",
  "data",
  ...listDatasets().map((d) => `data/${d.slug}`),
  "games",
  ...listGames().map((g) => `games/${g.slug}`),
  "subscribe",
  "about",
  "about/dustin-edwards",
  "privacy",
  "terms",
  "accessibility",
  "contact",
  "txasm",
];

/** Every page of the sitemap that no post row dates, as the path the sitemap's loc has after the origin. */
async function datedPaths(env: Env): Promise<string[]> {
  const seasons = await listSeasons(env);
  return [...STATIC_PATHS.map((p) => `/${p}`), ...seasons.map((s) => `/season/${s}`)];
}

/** The daily job: date every hub and static page of the sitemap. */
export async function runPageDates(env: Env): Promise<{ rowsProcessed: number }> {
  const store = kvPageRecord(env.APP_KV, PAGE_DATES_KEY);
  const { record } = await trackRenderedPageDates({
    paths: await datedPaths(env),
    origin: SITE_ORIGIN,
    env,
    ...store,
  });
  return { rowsProcessed: Object.keys(record).length };
}
