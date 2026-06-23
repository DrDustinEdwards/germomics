// Admin -> Soundbites: CRUD for episode clips (episode, start, duration, title). Behind the admin
// gate. Clips render a public clip player on the episode page and emit <podcast:soundbite> in the
// feed. Drizzle via soundbites.server.
import { useState } from "react";
import { useFetcher } from "react-router";
import { Scissors, Trash2 } from "lucide-react";
import type { Route } from "./+types/admin.soundbites._index";
import { getEnv } from "~/lib/context.server";
import { listEpisodes } from "~/lib/posts.server";
import { listSoundbites, upsertSoundbite, deleteSoundbite } from "~/lib/soundbites.server";
import { formatDuration } from "~/lib/format";
import { Card, Field, Button, inputCx, EmptyState } from "~/components/admin/ui";
import { useSnippet } from "~/lib/content";

export async function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const [episodes, clips] = await Promise.all([listEpisodes(env), listSoundbites(env)]);
  return {
    episodes: episodes.map((e) => ({ id: e.id, title: e.title })),
    clips,
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const form = await request.formData();
  if (String(form.get("intent")) === "delete") {
    await deleteSoundbite(env, Number(form.get("id")));
    return { ok: true as const, message: "Deleted." };
  }
  await upsertSoundbite(env, {
    id: form.get("id") ? Number(form.get("id")) : undefined,
    postId: Number(form.get("postId")),
    startSeconds: Number(form.get("startSeconds")),
    durationSeconds: Number(form.get("durationSeconds")),
    title: String(form.get("title") || ""),
  });
  return { ok: true as const, message: "Saved." };
}

export default function SoundbitesAdmin({ loaderData }: Route.ComponentProps) {
  const { episodes, clips } = loaderData;
  const save = useFetcher<{ ok: boolean; message?: string }>();
  const del = useFetcher();
  const emptySoundbites = useSnippet("snippet:empty.soundbites", "No soundbites yet. Create one on the right.");
  const titleById = new Map(episodes.map((e) => [e.id, e.title]));

  return (
    <div>
      <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
        <Scissors size={22} aria-hidden /> Soundbites
      </h1>
      <p className="mt-1 text-sm text-muted">
        Short clips of an episode. They power the episode clip player and the feed soundbite tags.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div>
          {clips.length === 0 ? (
            <EmptyState>{emptySoundbites}</EmptyState>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {clips.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-medium text-ink">{c.title || "(untitled clip)"}</p>
                    <p className="truncate font-mono text-[11px] text-muted">
                      {titleById.get(c.postId) ?? `post ${c.postId}`} · {formatDuration(c.startSeconds)} for {c.durationSeconds}s
                    </p>
                  </div>
                  <del.Form method="post" onSubmit={(e) => { if (!confirm("Delete this soundbite?")) e.preventDefault(); }}>
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={c.id} />
                    <button aria-label="Delete soundbite" className="grid h-7 w-7 place-items-center rounded text-muted hover:text-brand">
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </del.Form>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside>
          <Card title="New soundbite" icon={<Scissors size={15} aria-hidden />}>
            <save.Form method="post" className="space-y-4">
              <Field label="Episode" required>
                {({ id }) => (
                  <select id={id} name="postId" className={inputCx} required defaultValue="">
                    <option value="" disabled>
                      Choose an episode
                    </option>
                    {episodes.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start (seconds)" required>
                  {({ id }) => <input id={id} name="startSeconds" type="number" min={0} className={inputCx} required />}
                </Field>
                <Field label="Duration (seconds)" required>
                  {({ id }) => <input id={id} name="durationSeconds" type="number" min={1} defaultValue={30} className={inputCx} required />}
                </Field>
              </div>
              <Field label="Title" hint="Optional. Shown on the clip and in the feed.">
                {({ id }) => <input id={id} name="title" className={inputCx} />}
              </Field>
              <div className="flex items-center gap-3">
                <Button type="submit" variant="primary" disabled={save.state !== "idle"}>Create</Button>
                {save.data?.ok ? <span role="status" className="font-mono text-xs text-accent">{save.data.message}</span> : null}
              </div>
            </save.Form>
          </Card>
        </aside>
      </div>
    </div>
  );
}
