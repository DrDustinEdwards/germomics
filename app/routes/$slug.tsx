import type { Route } from "./+types/$slug";
import { getEnv } from "~/lib/context.server";
import { getPostBySlug, relatedPosts, adjacentPosts, toPlayerTrack } from "~/lib/posts.server";
import { getEpisodeGuests } from "~/lib/people.server";
import { soundbitesForPost } from "~/lib/soundbites.server";
import { getShowConfig } from "~/lib/show.server";
import {
  readingTime,
  tableOfContents,
  buildJsonLd,
  buildBreadcrumbLd,
  extractFaqLd,
  ogImageFor,
} from "~/lib/seo";
import { PostDetail, type DetailData } from "~/components/content/PostDetail";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData?.post) return [{ title: "Not found · germomics" }];
  const { post, origin, author, seriesTitle, guests, hosts, ogImage } = loaderData;
  const title = `${post.seoTitle ?? post.title} · germomics`;
  const desc = post.seoDescription ?? post.excerpt ?? "";
  const image = ogImage;
  const jsonLd = buildJsonLd({ post, origin, author, seriesTitle, guests, hosts });
  const isEpisode = post.kind === "episode";
  const breadcrumb = buildBreadcrumbLd([
    { name: "Home", url: `${origin}/` },
    {
      name: isEpisode ? "Episodes" : "Writing",
      url: `${origin}/${isEpisode ? "episodes" : "writing"}`,
    },
    { name: post.title, url: `${origin}/${post.slug}` },
  ]);
  const faq = extractFaqLd(post.body);
  return [
    { title },
    { name: "description", content: desc },
    { property: "og:title", content: post.title },
    { property: "og:description", content: desc },
    // Episodes are editorial articles with audio on this site, so og:type is article (the prior
    // music.song regressed the social card). twitter:card is large because og:image is always set.
    { property: "og:type", content: "article" },
    { property: "og:url", content: `${origin}/${post.slug}` },
    ...(image ? [{ property: "og:image", content: image }] : []),
    { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: post.title },
    { name: "twitter:description", content: desc },
    ...(image ? [{ name: "twitter:image", content: image }] : []),
    { "script:ld+json": jsonLd },
    { "script:ld+json": breadcrumb },
    ...(faq ? [{ "script:ld+json": faq }] : []),
  ];
}

export async function loader({ params, context, request }: Route.LoaderArgs) {
  const env = getEnv(context);
  const post = await getPostBySlug(env, params.slug);
  if (!post) throw new Response("Not found", { status: 404 });

  const [related, show, guests, adj, clips] = await Promise.all([
    relatedPosts(env, post),
    getShowConfig(env),
    getEpisodeGuests(env, post),
    adjacentPosts(env, post),
    post.kind === "episode" ? soundbitesForPost(env, post.id) : Promise.resolve([]),
  ]);
  const origin = new URL(request.url).origin;
  const hosts = show.hosts ?? [];
  // Every episode defaults its hero cover and social image to the show artwork unless it sets its own.
  const cover = post.coverImage ?? show.artwork ?? null;
  const ogImage = ogImageFor(post) ?? show.artwork ?? null;

  const data: DetailData & {
    origin: string;
    seriesTitle: string;
    hosts: typeof hosts;
    ogImage: string | null;
  } = {
    post,
    track: post.kind === "episode" ? toPlayerTrack(post) : null,
    soundbites: clips.map((c) => ({ id: c.id, start: c.startSeconds, duration: c.durationSeconds, title: c.title })),
    guests,
    related,
    prev: adj.prev ? { slug: adj.prev.slug, title: adj.prev.title } : null,
    next: adj.next ? { slug: adj.next.slug, title: adj.next.title } : null,
    subscribeLinks: show.subscribeLinks ?? {},
    author: show.author,
    hosts,
    cover,
    readingMinutes: post.readingTime ?? readingTime(post.body),
    toc: tableOfContents(post.body),
    origin,
    seriesTitle: show.title,
    ogImage,
  };
  return data;
}

export default function Detail({ loaderData }: Route.ComponentProps) {
  return <PostDetail data={loaderData} />;
}
