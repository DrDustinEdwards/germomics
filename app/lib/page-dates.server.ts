import { kvPageRecord, trackPageDates } from "@drdustinedwards/site-helpers/lastmod";
import { htmlToMarkdown } from "@drdustinedwards/site-helpers/markdown-copy";
import { SITE_ORIGIN } from "~/lib/site";
import { listSeasons } from "~/lib/posts.server";

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
  "games",
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
export async function datedPaths(env: Env): Promise<string[]> {
  const seasons = await listSeasons(env);
  return [...STATIC_PATHS.map((p) => `/${p}`), ...seasons.map((s) => `/season/${s}`)];
}

/** Renders a path through the Worker's own page handler and returns its HTML, or null when it is not a page. workers/app.ts sets it. */
export type PageRenderer = (path: string, env: Env) => Promise<string | null>;
let renderPage: PageRenderer | undefined;
export function setPageRenderer(renderer: PageRenderer): void {
  renderPage = renderer;
}

/** The record the job keeps, from the KV key. */
export function pageRecordStore(env: Env) {
  return kvPageRecord(env.APP_KV, PAGE_DATES_KEY);
}

/** The daily job: date every hub and static page of the sitemap. */
export async function runPageDates(env: Env): Promise<{ rowsProcessed: number }> {
  if (!renderPage) throw new Error("page-dates: no page renderer is set");
  const render = renderPage;
  const store = pageRecordStore(env);
  const { record } = await trackPageDates({
    paths: await datedPaths(env),
    read: async (path) => {
      const html = await render(path, env);
      if (html === null) return null;
      const facts = htmlToMarkdown(html, { base: `${SITE_ORIGIN}${path}` });
      return `${facts.title}\n${facts.description}\n${facts.markdown}`;
    },
    load: store.load,
    save: store.save,
  });
  return { rowsProcessed: Object.keys(record).length };
}
