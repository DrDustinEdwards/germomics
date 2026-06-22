// Guests field (§E): a People picker (search reusable entities, create-new inline, per-episode
// role, reorder) that writes episode↔person links — OR a raw-JSON fallback that writes the
// legacy `guests` column. The public resolver prefers linked people, falling back to the JSON.
import { useMemo, useState } from "react";
import { UserPlus, X, ArrowUp, ArrowDown, Users } from "lucide-react";
import { Tabs, inputCx, EmptyState, Button } from "./ui";
import type { Guest } from "~/lib/types";

export type PersonLite = { id: number; name: string; slug: string; role?: string | null };
export type SelectedPerson = { personId: number; role: string };

export function GuestsField({
  people,
  selected,
  onSelectedChange,
  guestsJson,
  onGuestsJsonChange,
}: {
  people: PersonLite[];
  selected: SelectedPerson[];
  onSelectedChange: (next: SelectedPerson[]) => void;
  guestsJson: Guest[];
  onGuestsJsonChange: (next: Guest[]) => void;
}) {
  const [tab, setTab] = useState<"people" | "json">("people");
  const [list, setList] = useState<PersonLite[]>(people);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(guestsJson, null, 2));
  const [jsonErr, setJsonErr] = useState<string | null>(null);

  const byId = useMemo(() => new Map(list.map((p) => [p.id, p])), [list]);
  const selectedIds = new Set(selected.map((s) => s.personId));
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((p) => !selectedIds.has(p.id) && (!q || p.name.toLowerCase().includes(q)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, query, selected]);

  const exactExists = list.some((p) => p.name.toLowerCase() === query.trim().toLowerCase());

  function addPerson(id: number) {
    onSelectedChange([...selected, { personId: id, role: "" }]);
    setQuery("");
  }
  function removeAt(i: number) {
    onSelectedChange(selected.filter((_, idx) => idx !== i));
  }
  function setRole(i: number, role: string) {
    onSelectedChange(selected.map((s, idx) => (idx === i ? { ...s, role } : s)));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= selected.length) return;
    const copy = [...selected];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onSelectedChange(copy);
  }

  async function createInline() {
    const name = query.trim();
    if (!name) return;
    setCreating(true);
    try {
      const body = new FormData();
      body.set("intent", "quick-create");
      body.set("name", name);
      const res = await fetch("/admin/people", { method: "POST", body });
      const data = (await res.json()) as { ok: boolean; person?: PersonLite };
      if (data.ok && data.person) {
        setList((l) => [...l, data.person!]);
        addPerson(data.person.id);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-display text-sm font-medium text-ink">
          <Users size={14} aria-hidden /> Guests
        </span>
        <Tabs
          label="Guests input method"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "people", label: "People" },
            { value: "json", label: "Raw JSON" },
          ]}
        />
      </div>

      {tab === "people" ? (
        <>
          {selected.length === 0 ? (
            <EmptyState>No guests linked yet.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {selected.map((s, i) => {
                const p = byId.get(s.personId);
                return (
                  <li key={s.personId} className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5">
                    <span className="min-w-0 flex-1 truncate font-display text-sm text-ink">
                      {p?.name ?? `#${s.personId}`}
                    </span>
                    <input
                      aria-label={`Role for ${p?.name ?? "guest"}`}
                      placeholder="role on this episode"
                      value={s.role}
                      onChange={(e) => setRole(i, e.target.value)}
                      className={`${inputCx} w-40 text-xs`}
                    />
                    <div className="flex">
                      <button type="button" aria-label="Move up" onClick={() => move(i, -1)} className="grid h-8 w-8 place-items-center rounded text-muted hover:text-ink">
                        <ArrowUp size={14} aria-hidden />
                      </button>
                      <button type="button" aria-label="Move down" onClick={() => move(i, 1)} className="grid h-8 w-8 place-items-center rounded text-muted hover:text-ink">
                        <ArrowDown size={14} aria-hidden />
                      </button>
                      <button type="button" aria-label="Remove guest" onClick={() => removeAt(i)} className="grid h-8 w-8 place-items-center rounded text-muted hover:text-brand">
                        <X size={14} aria-hidden />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people, or type a new name…"
              className={inputCx}
              aria-label="Search or add a guest"
            />
            {query.trim() ? (
              <div className="mt-1 overflow-hidden rounded-lg border border-border bg-card">
                {matches.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addPerson(p.id)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface"
                  >
                    <span>{p.name}</span>
                    {p.role ? <span className="font-mono text-[11px] text-muted">{p.role}</span> : null}
                  </button>
                ))}
                {!exactExists ? (
                  <button
                    type="button"
                    onClick={createInline}
                    disabled={creating}
                    className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm text-accent hover:bg-surface disabled:opacity-50"
                  >
                    <UserPlus size={14} aria-hidden /> Create “{query.trim()}”
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <p className="text-[11px] text-muted">
            New people are reusable across episodes — edit full bios &amp; photos under{" "}
            <a href="/admin/people" className="text-accent underline">People</a>.
          </p>
        </>
      ) : (
        <div className="space-y-2">
          <textarea
            value={jsonText}
            rows={6}
            spellCheck={false}
            placeholder='[{ "name": "…", "role": "…", "bio": "…", "link": "…" }]'
            className={`${inputCx} font-mono text-xs`}
            onChange={(e) => {
              setJsonText(e.target.value);
              try {
                const parsed = JSON.parse(e.target.value) as Guest[];
                if (!Array.isArray(parsed)) throw new Error("must be an array");
                setJsonErr(null);
                onGuestsJsonChange(parsed);
              } catch (err) {
                setJsonErr(err instanceof Error ? err.message : "invalid JSON");
              }
            }}
          />
          {jsonErr ? <p role="alert" className="text-xs text-brand">JSON error: {jsonErr}</p> : null}
          <p className="text-[11px] text-muted">
            Used only when no People are linked above (legacy fallback).
          </p>
        </div>
      )}
    </div>
  );
}
