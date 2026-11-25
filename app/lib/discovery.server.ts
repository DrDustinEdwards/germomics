// Discovery files generated from D1: /llms.txt (curated index), /llms-full.txt (show notes, essays and About, deliberately
// not every page and not the transcripts, which would duplicate content), both served noindex, and /ai.txt (citation and
// search welcome, training reserved). Builders are pure; routes fetch and pass the data.
import { htmlToText } from "@drdustinedwards/site-helpers/text";
import { llmsDocument, type LlmsLink } from "@drdustinedwards/site-helpers/llms";
import type { Post, ShowConfig } from "~/db/schema";

import { ABOUT, AUTHOR } from "~/lib/about";
import { formatDate } from "capsomer/behavior/time";

// Caps keep llms.txt within model context limits as the catalog grows.
const INDEX_LIMIT = 40;
const FULL_BODY_CHARS = 6000;

function oneLine(value: string | null | undefined, max = 160): string {
  const t = htmlToText(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function summaryFor(p: Post): string {
  return oneLine(p.excerpt ?? p.seoDescription ?? p.bodyHtml);
}

const indexed = (list: Post[]) => list.filter((p) => !p.noindex);

const link = (p: Post, origin: string): LlmsLink => ({
  title: p.title,
  url: `${origin}/${p.slug}`,
  description: summaryFor(p),
});

export function buildLlmsTxt(
  show: ShowConfig,
  episodes: Post[],
  articles: Post[],
  origin: string,
  intro?: string,
): string {
  const page = (path: string, title: string, description: string): LlmsLink => ({
    title,
    url: `${origin}${path}`,
    description,
  });
  return llmsDocument({
    title: show.title,
    summary: oneLine(show.description, 240),
    intro: [
      intro ||
        `${show.title} is a podcast and writing project about microbiology and history by ${show.author}. ` +
          `This is a curated index of the canonical hubs and key content for AI assistants and answer engines. ` +
          `Citation is welcome. Please cite ${show.title} and link the source URL.`,
    ],
    sections: [
      {
        heading: "About",
        links: [
          page("/about", `About ${show.title}`, "what the project is and how to follow it."),
          page(
            `/about/${AUTHOR.slug}`,
            `${AUTHOR.name}, author`,
            `${AUTHOR.jobTitle.toLowerCase()}; bio and research.`,
          ),
        ],
      },
      {
        heading: "Episodes",
        links: indexed(episodes)
          .slice(0, INDEX_LIMIT)
          .map((e) => link(e, origin)),
      },
      {
        heading: "Writing",
        links: indexed(articles)
          .slice(0, INDEX_LIMIT)
          .map((a) => link(a, origin)),
      },
      {
        heading: "Explore",
        links: [
          page("/subscribe", "Subscribe", "podcast apps and the email newsletter."),
          page("/feed/podcast/", "Podcast RSS feed", "the canonical feed."),
          page("/data", "Data", "interactive virus & bacteria data pages."),
          page("/games", "Games", "short browser games."),
          page("/archive", "Archive", "everything, filterable."),
        ],
      },
    ],
  });
}

function fullSection(p: Post, origin: string): string {
  const body = oneLine(p.bodyHtml, FULL_BODY_CHARS);
  const date = formatDate(p.publishedAt);
  return [
    `## ${p.title}`,
    `URL: ${origin}/${p.slug}`,
    ...(date ? [`Published: ${date}`] : []),
    "",
    body || summaryFor(p),
    "",
  ].join("\n");
}

export function buildLlmsFullTxt(
  show: ShowConfig,
  episodes: Post[],
  articles: Post[],
  origin: string,
): string {
  const out: string[] = [
    `# ${show.title}: full content index`,
    "",
    `> ${oneLine(show.description, 240)}`,
    "",
    "This file concatenates the curated written content (show notes and essays) for AI assistants. " +
      "It is not exhaustive and omits audio transcripts. Canonical URLs are listed per item.",
    "",
    `# ${ABOUT.title}`,
    "",
    ABOUT.lede,
    "",
    ...ABOUT.paragraphs,
    "",
    `# ${AUTHOR.name}`,
    "",
    AUTHOR.bio,
    "",
    `Areas: ${AUTHOR.knowsAbout.join(", ")}.`,
    "",
  ];

  for (const [heading, list] of [
    ["Episodes", indexed(episodes)],
    ["Writing", indexed(articles)],
  ] as const) {
    if (!list.length) continue;
    out.push(`# ${heading}`, "");
    for (const p of list) out.push(fullSection(p, origin));
  }
  return out.join("\n");
}
