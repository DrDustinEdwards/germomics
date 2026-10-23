// GEO / agentic-web discovery files, generated dynamically from D1 so they stay fresh:
//   /llms.txt       — a curated Markdown index (hubs + key content), the llms.txt convention.
//   /llms-full.txt  — a fuller, still-curated concatenation of the written canonical content
//                     (show notes + essays + About). Deliberately NOT every page and NOT the
//                     transcripts — that would be the duplicate-content anti-pattern the audit warns
//                     against. Both are served with X-Robots-Tag: noindex (they're machine indexes,
//                     not pages to rank).
//   /ai.txt         — purpose-based access policy: citation/search welcome, training reserved.
//
// Builders are pure (data in, string out) so they're trivial to test; routes fetch + pass data.
import { llmsDocument, type LlmsLink } from "@drdustinedwards/site-helpers/llms";
import type { Post, ShowConfig } from "~/db/schema";
import { stripHtml } from "~/lib/seo";
import { ABOUT, AUTHOR } from "~/lib/about";
import { formatDate } from "~/lib/format";

// Curation caps — keep llms.txt well within model context limits even as the catalog grows.
const INDEX_LIMIT = 40;
const FULL_BODY_CHARS = 6000;

function oneLine(value: string | null | undefined, max = 160): string {
  const t = stripHtml(value ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function summaryFor(p: Post): string {
  return oneLine(p.excerpt ?? p.seoDescription ?? p.body);
}

const link = (p: Post, origin: string): LlmsLink => ({ title: p.title, url: `${origin}/${p.slug}`, description: summaryFor(p) });

/** Curated Markdown index of hubs + key content, in Prelum's llms.txt skeleton. */
export function buildLlmsTxt(
  show: ShowConfig,
  episodes: Post[],
  articles: Post[],
  origin: string,
  intro?: string,
): string {
  const page = (path: string, title: string, description: string): LlmsLink => ({ title, url: `${origin}${path}`, description });
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
      { heading: "About", links: [
        page("/about", `About ${show.title}`, "what the project is and how to follow it."),
        page(`/about/${AUTHOR.slug}`, `${AUTHOR.name}, author`, `${AUTHOR.jobTitle.toLowerCase()}; bio and research.`),
      ] },
      { heading: "Episodes", links: episodes.slice(0, INDEX_LIMIT).map((e) => link(e, origin)) },
      { heading: "Writing", links: articles.slice(0, INDEX_LIMIT).map((a) => link(a, origin)) },
      { heading: "Explore", links: [
        page("/subscribe", "Subscribe", "podcast apps and the email newsletter."),
        page("/feed/podcast/", "Podcast RSS feed", "the canonical feed."),
        page("/data", "Data", "interactive virus & bacteria data pages."),
        page("/games", "Games", "short browser games."),
        page("/archive", "Archive", "everything, filterable."),
      ] },
    ],
  });
}

function fullSection(p: Post, origin: string): string {
  const body = oneLine(p.body, FULL_BODY_CHARS);
  const date = formatDate(p.publishedAt);
  return [
    `## ${p.title}`,
    `URL: ${origin}/${p.slug}`,
    date ? `Published: ${date}` : "",
    "",
    body || summaryFor(p),
    "",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/** Fuller, still-curated concatenation of the written canonical content. */
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

  if (episodes.length) {
    out.push("# Episodes", "");
    for (const e of episodes) out.push(fullSection(e, origin));
  }
  if (articles.length) {
    out.push("# Writing", "");
    for (const a of articles) out.push(fullSection(a, origin));
  }
  return out.join("\n");
}

/** Purpose-based AI access policy, consistent with robots.txt + the TDMRep header. */
export function buildAiTxt(show: ShowConfig, origin: string, policy?: string): string {
  const policyBlock = policy
    ? policy.split("\n")
    : [
        "# Citation and search (RAG, answer engines): ALLOWED.",
        "# Please cite the source and link the canonical URL.",
        "# Training data: rights reserved (opt-out). Contact for licensing in the address below.",
      ];
  return [
    `# ai.txt: AI usage policy for ${show.title} (${origin})`,
    "# Forward-looking signals for AI/LLM systems. Consistent with /robots.txt and the",
    "# TDMRep `tdm-reservation: 1` response header.",
    "",
    ...policyBlock,
    `# Curated index: ${origin}/llms.txt`,
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /preview/",
    "",
    "# Training data: rights reserved (opt-out). Contact for licensing:",
    `# ${show.ownerEmail}`,
    "Training: disallow",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    `Content-index: ${origin}/llms.txt`,
    "",
  ].join("\n");
}
