// People admin (§E): CRUD for reusable guest entities. The same action serves the editor's
// inline "quick-create" (returns JSON) used by the episode guests picker.
import { useState } from "react";
import { useFetcher } from "react-router";
import { UserPlus, Trash2, Plus, X, Users } from "lucide-react";
import type { Route } from "./+types/admin.people._index";
import { getEnv } from "~/lib/context.server";
import { listPeople, upsertPerson, deletePerson } from "~/lib/people.server";
import { Card, Field, Button, inputCx, EmptyState } from "~/components/admin/ui";
import { ImageField } from "~/components/admin/ImageField";
import type { Person, PersonLink } from "~/db/schema";

export async function loader({ context }: Route.LoaderArgs) {
  return { people: await listPeople(getEnv(context)) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const form = await request.formData();
  const intent = String(form.get("intent") || "upsert");

  if (intent === "quick-create") {
    const id = await upsertPerson(env, { name: String(form.get("name") || "").trim() || "Unnamed" });
    const person = (await listPeople(env)).find((p) => p.id === id);
    return Response.json({
      ok: true,
      person: person ? { id: person.id, name: person.name, slug: person.slug, role: person.role } : null,
    });
  }

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

const blank = { id: 0, name: "", role: "", bio: "", photo: "", photoAlt: "", links: [] as PersonLink[] };

export default function PeopleAdmin({ loaderData }: Route.ComponentProps) {
  const save = useFetcher<{ ok: boolean; message?: string }>();
  const del = useFetcher();
  const [draft, setDraft] = useState(blank);
  const editing = draft.id !== 0;

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
        <Users size={22} aria-hidden /> People
      </h1>
      <p className="mt-1 text-sm text-muted">Reusable guests. Link them to episodes from the editor.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        {/* List */}
        <div>
          {loaderData.people.length === 0 ? (
            <EmptyState>No people yet. Create one on the right.</EmptyState>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {loaderData.people.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  {p.photo ? (
                    <img src={p.photo} alt={p.photoAlt ?? ""} className="h-10 w-10 rounded-full border border-border object-cover" />
                  ) : (
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-surface text-brand"><Users size={16} aria-hidden /></span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-medium text-ink">{p.name}</p>
                    {p.role ? <p className="truncate font-mono text-[11px] text-muted">{p.role}</p> : null}
                  </div>
                  <button type="button" onClick={() => load(p)} className="rounded px-2 py-1 font-mono text-xs text-accent hover:underline">edit</button>
                  <del.Form method="post" onSubmit={(e) => { if (!confirm(`Delete ${p.name}?`)) e.preventDefault(); }}>
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={p.id} />
                    <button aria-label={`Delete ${p.name}`} className="grid h-7 w-7 place-items-center rounded text-muted hover:text-brand"><Trash2 size={14} aria-hidden /></button>
                  </del.Form>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Editor */}
        <aside>
          <Card title={editing ? "Edit person" : "New person"} icon={editing ? undefined : <UserPlus size={15} aria-hidden />}
            actions={editing ? <button type="button" onClick={() => setDraft(blank)} className="font-mono text-xs text-muted hover:text-ink">+ new</button> : undefined}>
            <save.Form method="post" className="space-y-4">
              {editing ? <input type="hidden" name="id" value={draft.id} /> : null}
              <input type="hidden" name="photo" value={draft.photo} />
              <input type="hidden" name="photoAlt" value={draft.photoAlt} />
              <input type="hidden" name="links" value={JSON.stringify(draft.links)} />

              <Field label="Name" required>
                {({ id }) => <input id={id} name="name" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className={inputCx} required />}
              </Field>
              <Field label="Role / title">
                {({ id }) => <input id={id} name="role" value={draft.role} onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))} className={inputCx} />}
              </Field>
              <Field label="Bio">
                {({ id }) => <textarea id={id} name="bio" value={draft.bio} rows={3} onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))} className={inputCx} />}
              </Field>

              <ImageField
                label="Photo"
                url={draft.photo}
                alt={draft.photoAlt}
                postId="people"
                onChange={({ url, alt }) => setDraft((d) => ({ ...d, photo: url, photoAlt: alt }))}
              />

              <div>
                <span className="font-display text-sm font-medium text-ink">Links</span>
                <div className="mt-2 space-y-2">
                  {draft.links.map((l, i) => (
                    <div key={i} className="flex gap-2">
                      <input aria-label="Link label" placeholder="label" value={l.label} onChange={(e) => setDraft((d) => ({ ...d, links: d.links.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x) }))} className={`${inputCx} w-28 text-xs`} />
                      <input aria-label="Link URL" placeholder="https://" value={l.url} onChange={(e) => setDraft((d) => ({ ...d, links: d.links.map((x, idx) => idx === i ? { ...x, url: e.target.value } : x) }))} className={`${inputCx} flex-1 text-xs`} />
                      <button type="button" aria-label="Remove link" onClick={() => setDraft((d) => ({ ...d, links: d.links.filter((_, idx) => idx !== i) }))} className="grid h-8 w-8 place-items-center rounded text-muted hover:text-brand"><X size={14} aria-hidden /></button>
                    </div>
                  ))}
                  <Button type="button" variant="ghost" onClick={() => setDraft((d) => ({ ...d, links: [...d.links, { label: "", url: "" }] }))}><Plus size={13} aria-hidden /> Add link</Button>
                </div>
              </div>

              <input type="hidden" name="intent" value="upsert" />
              <div className="flex items-center gap-3">
                <Button type="submit" variant="primary" disabled={save.state !== "idle"}>{editing ? "Save" : "Create"}</Button>
                {save.data?.ok ? <span className="font-mono text-xs text-accent">{save.data.message}</span> : null}
              </div>
            </save.Form>
          </Card>
        </aside>
      </div>
    </div>
  );
}
