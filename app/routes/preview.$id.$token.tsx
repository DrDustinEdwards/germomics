// Tokenized "preview as published" route (§F). Renders any post (draft/scheduled/published) via
// the shared PostDetail, gated by an unguessable token rather than a login, so the author can
// share a preview. Marked noindex.
import type { Route } from "./+types/preview.$id.$token";
import { getEnv } from "~/lib/context.server";
import { getPostById, relatedPosts, toPlayerTrack } from "~/lib/posts.server";
import { getEpisodeGuests } from "~/lib/people.server";
import { getShowConfig } from "~/lib/show.server";
import { readingTime, tableOfContents } from "~/lib/seo";
import { verifyPreviewToken } from "~/lib/preview.server";
import { PostDetail, type DetailData } from "~/components/content/PostDetail";

export function meta() {
  return [{ title: "Preview · germomics" }, { name: "robots", content: "noindex, nofollow" }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const id = Number(params.id);
  if (!(await verifyPreviewToken(env, id, params.token))) {
    throw new Response("Not found", { status: 404 });
  }
  const post = await getPostById(env, id);
  if (!post) throw new Response("Not found", { status: 404 });

  const [related, show, guests] = await Promise.all([
    relatedPosts(env, post),
    getShowConfig(env),
    getEpisodeGuests(env, post),
  ]);

  const data: DetailData = {
    post,
    track: post.kind === "episode" && post.audioUrl ? toPlayerTrack(post) : null,
    guests,
    related,
    prev: null,
    next: null,
    subscribeLinks: show.subscribeLinks ?? {},
    author: show.author,
    readingMinutes: readingTime(post.body),
    toc: tableOfContents(post.body),
    preview: true,
  };
  return data;
}

export default function Preview({ loaderData }: Route.ComponentProps) {
  return <PostDetail data={loaderData} />;
}
