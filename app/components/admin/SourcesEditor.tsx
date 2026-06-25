// References / credits editor. Rows of {type, title, url, authors, publisher, note, license}.
// Covers the episode Sources block and image/music credits (type select). Title is required;
// everything else is optional. Persists as Source[] on the post; add / reorder / delete.
import { Plus, Trash2, ArrowUp, ArrowDown, BookText } from "lucide-react";
import { Button, inputCx, EmptyState } from "./ui";
import type { Source } from "~/lib/types";

const TYPES: Source["type"][] = ["credit", "music", "image", "article", "book", "web"];

export function SourcesEditor({
  sources,
  onChange,
}: {
  sources: Source[];
  onChange: (next: Source[]) => void;
}) {
  function update(i: number, patch: Partial<Source>) {
    onChange(sources.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function add() {
    onChange([...sources, { type: "article", title: "" }]);
  }
  function remove(i: number) {
    onChange(sources.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= sources.length) return;
    const copy = [...sources];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  }

  return (
    <div className="space-y-3">
      <span className="flex items-center gap-1.5 font-display text-sm font-medium text-ink">
        <BookText size={14} aria-hidden /> Sources &amp; credits
      </span>

      {sources.length === 0 ? (
        <EmptyState>No sources yet.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {sources.map((s, i) => (
            <li key={i} className="rounded-xl border border-border bg-card p-2.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-muted">#{i + 1}</span>
                <select
                  aria-label={`Source ${i + 1} type`}
                  value={s.type}
                  onChange={(e) => update(i, { type: e.target.value })}
                  className={`${inputCx} w-28`}
                >
                  {TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <input
                  aria-label={`Source ${i + 1} title`}
                  placeholder="Title (required)"
                  value={s.title}
                  onChange={(e) => update(i, { title: e.target.value })}
                  className={`${inputCx} flex-1`}
                />
                <div className="flex">
                  <button type="button" aria-label="Move up" onClick={() => move(i, -1)} className="grid h-8 w-8 place-items-center rounded text-muted hover:text-ink">
                    <ArrowUp size={14} aria-hidden />
                  </button>
                  <button type="button" aria-label="Move down" onClick={() => move(i, 1)} className="grid h-8 w-8 place-items-center rounded text-muted hover:text-ink">
                    <ArrowDown size={14} aria-hidden />
                  </button>
                  <button type="button" aria-label="Delete source" onClick={() => remove(i)} className="grid h-8 w-8 place-items-center rounded text-muted hover:text-brand">
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  aria-label={`Source ${i + 1} URL (optional)`}
                  placeholder="URL"
                  value={s.url ?? ""}
                  onChange={(e) => update(i, { url: e.target.value || undefined })}
                  className={`${inputCx} text-xs`}
                />
                <input
                  aria-label={`Source ${i + 1} authors (optional)`}
                  placeholder="Authors"
                  value={s.authors ?? ""}
                  onChange={(e) => update(i, { authors: e.target.value || undefined })}
                  className={`${inputCx} text-xs`}
                />
                <input
                  aria-label={`Source ${i + 1} publisher (optional)`}
                  placeholder="Publisher"
                  value={s.publisher ?? ""}
                  onChange={(e) => update(i, { publisher: e.target.value || undefined })}
                  className={`${inputCx} text-xs`}
                />
                <input
                  aria-label={`Source ${i + 1} license (optional)`}
                  placeholder="License"
                  value={s.license ?? ""}
                  onChange={(e) => update(i, { license: e.target.value || undefined })}
                  className={`${inputCx} text-xs`}
                />
                <input
                  aria-label={`Source ${i + 1} note (optional)`}
                  placeholder="Note"
                  value={s.note ?? ""}
                  onChange={(e) => update(i, { note: e.target.value || undefined })}
                  className={`${inputCx} col-span-2 text-xs`}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button type="button" variant="ghost" onClick={add}>
        <Plus size={14} aria-hidden /> Add source
      </Button>
    </div>
  );
}
