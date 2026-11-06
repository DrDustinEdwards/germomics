// Show hosts editor (show-level byline). Rows of {name, role, img, href}; name required.
// Persists as Host[] on show_config and maps to <podcast:person> in the feed. Add / reorder /
// delete, mirroring the other repeatable-row editors.
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button, inputCx, EmptyState } from "./ui";
import type { Host } from "~/db/schema";

export function HostsEditor({
  hosts,
  onChange,
}: {
  hosts: Host[];
  onChange: (next: Host[]) => void;
}) {
  function update(i: number, patch: Partial<Host>) {
    onChange(hosts.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  }
  function add() {
    onChange([...hosts, { name: "" }]);
  }
  function remove(i: number) {
    onChange(hosts.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= hosts.length) return;
    const copy = [...hosts];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  }

  return (
    <div className="space-y-3">
      {hosts.length === 0 ? (
        <EmptyState>No hosts yet.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {hosts.map((h, i) => (
            <li key={i} className="rounded-xl border border-border bg-card p-2.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-muted">#{i + 1}</span>
                <input
                  aria-label={`Host ${i + 1} name`}
                  placeholder="Name (required)"
                  value={h.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  className={`${inputCx} flex-1`}
                />
                <input
                  aria-label={`Host ${i + 1} role`}
                  placeholder="Role"
                  value={h.role ?? ""}
                  onChange={(e) => update(i, { role: e.target.value || undefined })}
                  className={`${inputCx} w-40`}
                />
                <div className="flex">
                  <button type="button" aria-label="Move up" onClick={() => move(i, -1)} className="grid h-8 w-8 place-items-center rounded text-muted hover:text-ink">
                    <ArrowUp size={14} aria-hidden />
                  </button>
                  <button type="button" aria-label="Move down" onClick={() => move(i, 1)} className="grid h-8 w-8 place-items-center rounded text-muted hover:text-ink">
                    <ArrowDown size={14} aria-hidden />
                  </button>
                  <button type="button" aria-label="Delete host" onClick={() => remove(i)} className="grid h-8 w-8 place-items-center rounded text-muted hover:text-brand">
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  aria-label={`Host ${i + 1} image URL (optional)`}
                  placeholder="Image URL"
                  value={h.img ?? ""}
                  onChange={(e) => update(i, { img: e.target.value || undefined })}
                  className={`${inputCx} text-xs`}
                />
                <input
                  aria-label={`Host ${i + 1} link (optional)`}
                  placeholder="Link URL"
                  value={h.href ?? ""}
                  onChange={(e) => update(i, { href: e.target.value || undefined })}
                  className={`${inputCx} text-xs`}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button type="button" variant="ghost" onClick={add}>
        <Plus size={14} aria-hidden /> Add host
      </Button>
    </div>
  );
}
