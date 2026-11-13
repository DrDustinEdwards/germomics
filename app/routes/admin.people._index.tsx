// People admin (§E): CRUD for reusable guest entities. An episode names its people by slug in Carrel
// (app/lib/carrel/source.ts), so a person is added here first.
import { useState } from "react";
import { useFetcher } from "react-router";
import { Icon } from "capsomer/react/icons";
import type { Route } from "./+types/admin.people._index";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { listPeople, upsertPerson, deletePerson } from "~/lib/people.server";
import { Panel } from "capsomer/react/panel";
import { Field } from "capsomer/react/field";
import { Button } from "capsomer/react/button";
import { Empty } from "capsomer/react/empty";
import { ImageField } from "~/components/admin/ImageField";
import { useSnippet } from "~/lib/content";
import type { Person, PersonLink } from "~/db/schema";
import { readForm } from "@dustinedwards/site-runtime/body";
import { ADMIN_FORM } from "~/lib/body.server";
import { confirmSubmit } from "capsomer/behavior/confirm-dialog";
import { TextField } from "capsomer/react/field";
import { RepeaterField } from "capsomer/react/repeater-field";
import "capsomer/repeater-field.css";

export async function loader({ context }: Route.LoaderArgs) {
  return { people: await listPeople(getEnv(context)) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const form = await readForm(request, ADMIN_FORM);
  const intent = String(form.get("intent") || "upsert");

  if (intent === "delete") {
    await deletePerson(env, Number(form.get("id")));
    return { ok: true as const, message: "Deleted." };
  }

  let links: PersonLink[] = [];
  try {
    links = JSON.parse(String(form.get("links") || "[]"));
  } catch {
    links = [];
  }
  const idRaw = form.get("id");
  await upsertPerson(env, {
    id: idRaw ? Number(idRaw) : undefined,
    name: String(form.get("name") || "").trim(),
    role: String(form.get("role") || ""),
    bio: String(form.get("bio") || ""),
    photo: String(form.get("photo") || ""),
    photoAlt: String(form.get("photoAlt") || ""),
    links: links.filter((l) => l.url?.trim()),
  });
  return { ok: true as const, message: "Saved." };
}

const blank = {
  id: 0,
  name: "",
  role: "",
  bio: "",
  photo: "",
  photoAlt: "",
  links: [] as PersonLink[],
};

export default function PeopleAdmin({ loaderData }: Route.ComponentProps) {
  const save = useFetcher<{ ok: boolean; message?: string }>();
  const del = useFetcher();
  const [draft, setDraft] = useState(blank);
  const editing = draft.id !== 0;
  const emptyPeople = useSnippet("snippet:empty.people", "No people yet. Create one on the right.");

  function load(p: Person) {
    setDraft({
      id: p.id,
      name: p.name,
      role: p.role ?? "",
      bio: p.bio ?? "",
      photo: p.photo ?? "",
      photoAlt: p.photoAlt ?? "",
      links: p.links ?? [],
    });
  }

  return (
    <div>
      <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
        <Icon name="people" className="size-[22px]" /> People
      </h1>
      <p className="mt-1 text-sm text-muted">
        Reusable guests. Link them to episodes from the editor.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        {/* List */}
        <div>
          {loaderData.people.length === 0 ? (
            <Empty kind="nothing-yet">{emptyPeople}</Empty>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {loaderData.people.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  {p.photo ? (
                    <img
                      src={p.photo}
                      alt={p.photoAlt ?? ""}
                      className="h-10 w-10 rounded-full border border-border object-cover"
                    />
                  ) : (
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-surface text-brand">
                      <Icon name="people" className="size-4" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-medium text-ink">{p.name}</p>
                    {p.role ? (
                      <p className="truncate font-mono text-[0.6875rem] text-muted">{p.role}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => load(p)}
                    className="rounded px-2 py-1 font-mono text-xs text-accent hover:underline"
                  >
                    edit
                  </button>
                  <del.Form
                    method="post"
                    onSubmit={(e) =>
                      confirmSubmit(e, {
                        title: `Delete ${p.name}?`,
                        action: "Delete person",
                      })
                    }
                  >
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      aria-label={`Delete ${p.name}`}
                      className="grid h-7 w-7 place-items-center rounded text-muted hover:text-brand"
                    >
                      <Icon name="trash" className="size-3.5" />
                    </button>
                  </del.Form>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Editor */}
        <aside>
          <Panel
            title={editing ? "Edit person" : "New person"}
            actions={
              editing ? (
                <button
                  type="button"
                  onClick={() => setDraft(blank)}
                  className="font-mono text-xs text-muted hover:text-ink"
                >
                  + new
                </button>
              ) : undefined
            }
          >
            <save.Form method="post" className="space-y-4">
              {editing ? <input type="hidden" name="id" value={draft.id} /> : null}
              <input type="hidden" name="photo" value={draft.photo} />
              <input type="hidden" name="photoAlt" value={draft.photoAlt} />

              <Field label="Name" required>
                {(control) => (
                  <input
                    {...control}
                    name="name"
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    className="cap-input"
                    required
                  />
                )}
              </Field>
              <Field label="Role / title">
                {(control) => (
                  <input
                    {...control}
                    name="role"
                    value={draft.role}
                    onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
                    className="cap-input"
                  />
                )}
              </Field>
              <Field label="Bio">
                {(control) => (
                  <textarea
                    {...control}
                    name="bio"
                    value={draft.bio}
                    rows={3}
                    onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
                    className="cap-input"
                  />
                )}
              </Field>

              <ImageField
                label="Photo"
                url={draft.photo}
                alt={draft.photoAlt}
                postId="people"
                onChange={({ url, alt }) => setDraft((d) => ({ ...d, photo: url, photoAlt: alt }))}
              />

              <RepeaterField
                legend="Links"
                rows={draft.links}
                onChange={(links) => setDraft((d) => ({ ...d, links }))}
                newRow={() => ({ label: "", url: "" })}
                rowLabel={(i) => `Link ${i + 1}`}
                addLabel="Add link"
                name="links"
                json
              >
                {(link, { set }) => (
                  <>
                    <TextField
                      label="Link label"
                      placeholder="label"
                      value={link.label}
                      onChange={(e) => set({ label: e.target.value })}
                    />
                    <TextField
                      label="Link URL"
                      placeholder="https://"
                      value={link.url}
                      onChange={(e) => set({ url: e.target.value })}
                    />
                  </>
                )}
              </RepeaterField>

              <input type="hidden" name="intent" value="upsert" />
              <div className="flex items-center gap-3">
                <Button type="submit" variant="primary" pending={save.state !== "idle"}>
                  {editing ? "Save" : "Create"}
                </Button>
                {save.data?.ok ? (
                  <span className="font-mono text-xs text-accent">{save.data.message}</span>
                ) : null}
              </div>
            </save.Form>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
