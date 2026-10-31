import type { Route } from "./+types/$slug";
import { getEnv, postPreviewContext } from "~/lib/context.server";
import { getPostBySlug, listPosts, relatedPosts, adjacentPosts, renamedPostRedirect, seriesOf, toPlayerTrack } from "~/lib/posts.server";
import { getEpisodeGuests } from "~/lib/people.server";
import { soundbitesForPost } from "~/lib/soundbites.server";
import { getShowConfig } from "~/lib/show.server";
import { buildJsonLd, ogImageFor, pageHead, stripHtml } from "~/lib/seo";
import { SITE_ORIGIN } from "~/lib/site";
import { faqPage, jsonLd } from "@drdustinedwards/site-helpers/schema";
import type { HeadImage } from "@drdustinedwards/site-helpers/head";
import { pageToc, storedBody } from "~/lib/render.server";
import { postImages, shareImage } from "~/lib/images.server";
import { PostDetail, type DetailData } from "~/components/content/PostDetail";

// An episode's page is the player's own (its surface, waveform, transcript read-along, chapters and progress), so it
// hydrates on load; an article sends no React (lib/hydration.ts).
export const handle = {
  hydrate: (data: unknown) => (data as { post?: { kind?: string } } | undefined)?.post?.kind === "episode",
};

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData?.post) return [{ title: "Not found · Germomics" }];
  const { post, author, seriesTitle, guests, hosts, ogImage } = loaderData;
  const isEpisode = post.kind === "episode";
  const season = isEpisode && post.seasonNumber
    ? [{ name: `Season ${post.seasonNumber}`, path: `/season/${post.seasonNumber}` }]
    : [];
  // The body's :::faq pairs, as Prelum rendered them, are its FAQPage.
  const pairs = post.bodyMeta?.faq ?? [];
  const faq = pairs.length ? faqPage(pairs) : null;
  return [
    // Episodes are editorial articles with audio on this site, so og:type is article (the prior
    // music.song regressed the social card).
    ...pageHead({
      path: `/${post.slug}`,
      title: `${post.seoTitle ?? post.title} · Germomics`,
      socialTitle: post.title,
      description: post.seoDescription || post.excerpt || stripHtml(post.bodyHtml ?? "") || `${post.title}, on Germomics.`,
      image: ogImage,
      canonical: post.canonical ? new URL(post.canonical, SITE_ORIGIN).href : undefined,
      noindex: post.noindex,
      type: "article",
      article: { published: post.publishedAt ?? post.publishAt, modified: post.updatedAt, author, tags: post.tags ?? [] },
      breadcrumbs: [
        { name: "Germomics", path: "/" },
        isEpisode ? { name: "Episodes", path: "/episodes" } : { name: "Writing", path: "/writing" },
        ...season,
        { name: post.title, path: `/${post.slug}` },
      ],
    }),
    jsonLd(buildJsonLd({ post, author, seriesTitle, guests, hosts })),
    ...(faq ? [jsonLd(faq)] : []),
  ];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  // Carrel's preview renders its draft here, in-process (context.server); no request from outside sets it.
  const draft = context.get(postPreviewContext);
  const [post, visible, show] = await Promise.all([draft ?? getPostBySlug(env, params.slug), listPosts(env), getShowConfig(env)]);
  // A slug Carrel renamed away from answers a permanent redirect to the post's address now.
  if (!post) throw (await renamedPostRedirect(env, params.slug)) ?? new Response("Not found", { status: 404 });

  const [guests, clips] = await Promise.all([
    getEpisodeGuests(env, post),
    post.kind === "episode" ? soundbitesForPost(env, post.id) : Promise.resolve([]),
  ]);
  const related = relatedPosts(visible, post);
  const adj = adjacentPosts(visible, post);
  const hosts = show.hosts ?? [];
  // Hero cover uses the item's own artwork; when it has none, the CoverArt component renders the SVG
  // brand default (so no raster default here). The social image defaults to the wordmark card.
  const cover = post.episodeArtwork ?? post.coverImage ?? null;
  const [{ html, meta }, images, ogImage] = await Promise.all([
    storedBody(env, post),
    postImages(env, post, cover, { guests, hosts }),
    shareImage(env, ogImageFor(post)),
  ]);

  const data: DetailData & {
    seriesTitle: string;
    hosts: typeof hosts;
    ogImage: HeadImage;
  } = {
    // The page shows the rendered HTML; the Markdown stays on the server.
    post: { ...post, body: "", bodyHtml: html, bodyMeta: meta },
    images,
    track: post.kind === "episode" ? toPlayerTrack(post) : null,
    soundbites: clips.map((c) => ({ id: c.id, start: c.startSeconds, duration: c.durationSeconds, title: c.title })),
    guests,
    related,
    prev: adj.prev ? { slug: adj.prev.slug, title: adj.prev.title } : null,
    next: adj.next ? { slug: adj.next.slug, title: adj.next.title } : null,
    subscribeLinks: show.subscribeLinks ?? {},
    author: post.authors?.[0] ?? show.author,
    authors: post.authors ?? null,
    series: seriesOf(visible, post),
    preview: !!draft,
    hosts,
    cover,
    readingMinutes: post.readingTime ?? 1,
    toc: pageToc(meta),
    seriesTitle: show.title,
    ogImage,
  };
  return data;
}

export default function Detail({ loaderData }: Route.ComponentProps) {
  return <PostDetail data={loaderData} />;
}
