// The episodes' audio (spec §C), the one part of a post that is not written in Carrel: each episode's sound file and
// transcript, which are files measured or converted in the browser (admin.episodes.$id.tsx). Everything else about a
// post, articles and episodes alike, is written in Carrel (app/lib/carrel/adapter.server.ts). A new episode starts here,
// with its audio, as a draft Carrel then writes and puts live.
import { Form, redirect } from "react-router";
import { Link } from "capsomer/react/link";
import { ExternalLink, Headphones, Plus } from "lucide-react";
import type { Route } from "./+types/admin.episodes._index";
import { getEnv } from "~/lib/context.server";
import { createDraft, listAllPosts } from "~/lib/admin.server";
import { carrelEditUrl } from "~/lib/site";
import { Badge, Button, EmptyState } from "~/components/admin/ui";

export async function loader({ context }: Route.LoaderArgs) {
  const all = await listAllPosts(getEnv(context));
  return {
    episodes: all
      .filter((p) => p.kind === "episode" && !p.trashedAt)
      .map((p) => ({ id: p.id, slug: p.slug, title: p.title, status: p.status, audio: !!p.audioUrl, transcript: !!p.transcript?.trim() })),
  };
}

export async function action({ context }: Route.ActionArgs) {
  const id = await createDraft(getEnv(context), "episode");
  throw redirect(`/admin/episodes/${id}`);
}

export default function AdminEpisodes({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Episode audio</h1>
        <Form method="post">
          <Button variant="primary"><Plus size={14} aria-hidden /> New episode</Button>
        </Form>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Each episode&apos;s sound file and transcript. Its words, artwork, chapters, people and publishing are written in Carrel.
      </p>

      <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {loaderData.episodes.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <Link to={`/admin/episodes/${p.id}`} className="flex min-w-0 items-center gap-2">
                <Headphones size={14} className="shrink-0 text-brand" aria-hidden />
                <span className="truncate font-display font-medium text-ink">{p.title}</span>
              </Link>
              <span className="flex shrink-0 items-center gap-2">
                <Badge tone={p.audio ? "accent" : "amber"}>{p.audio ? "audio" : "no audio"}</Badge>
                <Badge tone={p.transcript ? "accent" : "amber"}>{p.transcript ? "transcript" : "no transcript"}</Badge>
                <Badge tone={p.status === "published" ? "accent" : "muted"}>{p.status}</Badge>
                <a href={carrelEditUrl(p.slug)} aria-label={`Write ${p.title} in Carrel`} className="grid h-8 w-8 place-items-center rounded text-muted hover:text-ink">
                  <ExternalLink size={14} aria-hidden />
                </a>
              </span>
            </li>
          ))}
        </ul>
        {loaderData.episodes.length === 0 ? <EmptyState>No episodes yet.</EmptyState> : null}
      </div>
    </div>
  );
}
