// Tokenized "preview as published" route (§F). Renders any post (draft/scheduled/published) via
// the shared PostDetail, gated by an unguessable token rather than a login, so the author can
// share a preview. Marked noindex.
import type { Route } from "./+types/preview.$id.$token";
import { getEnv } from "~/lib/context.server";
import { getPostById, listPosts, relatedPosts, toPlayerTrack } from "~/lib/posts.server";
import { getEpisodeGuests } from "~/lib/people.server";
import { getShowConfig } from "~/lib/show.server";
import { pageToc, storedBody } from "~/lib/render.server";
import { verifyPreviewToken } from "~/lib/preview.server";
import { postImages } from "~/lib/images.server";
import { PostDetail, type DetailData } from "~/components/content/PostDetail";

export function meta() {
  return [{ title: "Preview · Germomics" }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const id = Number(params.id);
  if (!(await verifyPreviewToken(env, id, params.token))) {
    throw new Response("Not found", { status: 404 });
  }
  const post = await getPostById(env, id);
  if (!post) throw new Response("Not found", { status: 404 });

  const [visible, show, guests] = await Promise.all([
    listPosts(env),
    getShowConfig(env),
    getEpisodeGuests(env, post),
  ]);

  const cover = post.episodeArtwork ?? post.coverImage ?? null;
  const hosts = show.hosts ?? [];
  const [{ html, meta }, images] = await Promise.all([storedBody(env, post), postImages(env, post, cover, { guests, hosts })]);
  const data: DetailData = {
    // The page shows the rendered HTML; the Markdown stays on the server.
    post: { ...post, body: "", bodyHtml: html, bodyMeta: meta },
    images,
    track: post.kind === "episode" && post.audioUrl ? toPlayerTrack(post) : null,
    guests,
    related: relatedPosts(visible, post),
    prev: null,
    next: null,
    subscribeLinks: show.subscribeLinks ?? {},
    author: show.author,
    hosts,
    cover,
    readingMinutes: post.readingTime ?? 1,
    toc: pageToc(meta),
    preview: true,
  };
  return data;
}

export default function Preview({ loaderData }: Route.ComponentProps) {
  return <PostDetail data={loaderData} />;
}
