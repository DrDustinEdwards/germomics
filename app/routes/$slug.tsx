import type { Route } from "./+types/$slug";
import { getEnv } from "~/lib/context.server";
import { getPostBySlug, relatedPosts, adjacentPosts, toPlayerTrack } from "~/lib/posts.server";
import { getEpisodeGuests } from "~/lib/people.server";
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
  const { post, origin, author, seriesTitle, guests } = loaderData;
  const title = `${post.seoTitle ?? post.title} · germomics`;
  const desc = post.seoDescription ?? post.excerpt ?? "";
  const image = ogImageFor(post);
  const jsonLd = buildJsonLd({ post, origin, author, seriesTitle, guests });
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
    { property: "og:type", content: isEpisode ? "music.song" : "article" },
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

  const [related, show, guests, adj] = await Promise.all([
    relatedPosts(env, post),
    getShowConfig(env),
    getEpisodeGuests(env, post),
    adjacentPosts(env, post),
  ]);
  const origin = new URL(request.url).origin;

  const data: DetailData & { origin: string; seriesTitle: string } = {
    post,
    track: post.kind === "episode" ? toPlayerTrack(post) : null,
    guests,
    related,
    prev: adj.prev ? { slug: adj.prev.slug, title: adj.prev.title } : null,
    next: adj.next ? { slug: adj.next.slug, title: adj.next.title } : null,
    subscribeLinks: show.subscribeLinks ?? {},
    author: show.author,
    readingMinutes: readingTime(post.body),
    toc: tableOfContents(post.body),
    origin,
    seriesTitle: show.title,
  };
  return data;
}

export default function Detail({ loaderData }: Route.ComponentProps) {
  return <PostDetail data={loaderData} />;
}
