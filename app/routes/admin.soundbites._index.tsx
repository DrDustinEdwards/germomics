// Admin -> Soundbites: CRUD for episode clips (episode, start, duration, title). Behind the admin
// gate. Clips render a public clip player on the episode page and emit <podcast:soundbite> in the
// feed. Drizzle via soundbites.server.
import { useFetcher } from "react-router";
import { Icon, iconCut } from "capsomer/react/icons";
import type { Route } from "./+types/admin.soundbites._index";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { listEpisodes } from "~/lib/posts.server";
import { listSoundbites, upsertSoundbite, deleteSoundbite } from "~/lib/soundbites.server";
import { timecode } from "capsomer/behavior/time";
import { Panel } from "capsomer/react/panel";
import { Field } from "capsomer/react/field";
import { Button } from "capsomer/react/button";
import { Empty } from "capsomer/react/empty";
import { useSnippet } from "~/lib/content";
import { readForm } from "@dustinedwards/site-runtime/body";
import { ADMIN_FORM } from "~/lib/body.server";
import { DeleteRowForm } from "~/components/admin/DeleteRowForm";

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
  const form = await readForm(request, ADMIN_FORM);
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
  const emptySoundbites = useSnippet(
    "snippet:empty.soundbites",
    "No soundbites yet. Create one on the right.",
  );
  const titleById = new Map(episodes.map((e) => [e.id, e.title]));

  return (
    <div>
      <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
        <Icon d={iconCut} className="size-[22px]" /> Soundbites
      </h1>
      <p className="mt-1 text-sm text-muted">
        Short clips of an episode. They power the episode clip player and the feed soundbite tags.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div>
          {clips.length === 0 ? (
            <Empty kind="nothing-yet">{emptySoundbites}</Empty>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {clips.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-medium text-ink">
                      {c.title || "(untitled clip)"}
                    </p>
                    <p className="truncate font-mono text-[0.6875rem] text-muted">
                      {titleById.get(c.postId) ?? `post ${c.postId}`} ·{" "}
                      {timecode(c.startSeconds * 1000)} for {c.durationSeconds}s
                    </p>
                  </div>
                  <DeleteRowForm
                    fetcher={del}
                    id={c.id}
                    label="Delete soundbite"
                    title="Delete this soundbite?"
                    action="Delete soundbite"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside>
          <Panel title="New soundbite">
            <save.Form method="post" className="space-y-4">
              <Field label="Episode" required>
                {(control) => (
                  <select {...control} name="postId" className="cap-input" required defaultValue="">
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
                  {(control) => (
                    <input
                      {...control}
                      name="startSeconds"
                      type="number"
                      min={0}
                      className="cap-input"
                      required
                    />
                  )}
                </Field>
                <Field label="Duration (seconds)" required>
                  {(control) => (
                    <input
                      {...control}
                      name="durationSeconds"
                      type="number"
                      min={1}
                      defaultValue={30}
                      className="cap-input"
                      required
                    />
                  )}
                </Field>
              </div>
              <Field label="Title" help="Optional. Shown on the clip and in the feed.">
                {(control) => <input {...control} name="title" className="cap-input" />}
              </Field>
              <div className="flex items-center gap-3">
                <Button type="submit" variant="primary" pending={save.state !== "idle"}>
                  Create
                </Button>
                {save.data?.ok ? (
                  <span role="status" className="font-mono text-xs text-accent">
                    {save.data.message}
                  </span>
                ) : null}
              </div>
            </save.Form>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
