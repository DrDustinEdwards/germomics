// "In this episode" editor: rows of timestamp + label the listener can scan and click to seek.
// Distinct from player chapters (which drive the Podcasting 2.0 chapters file); both seek the
// player. Persists as KeyMoment[] on the post. Type mm:ss for the time; add / reorder / delete.
import { Plus, Trash2, ArrowUp, ArrowDown, Clock } from "lucide-react";
import { Button, inputCx, EmptyState } from "./ui";
import { formatDuration, stampToSeconds } from "~/lib/format";
import type { KeyMoment } from "~/lib/types";

export function KeyMomentsEditor({
  moments,
  onChange,
}: {
  moments: KeyMoment[];
  onChange: (next: KeyMoment[]) => void;
}) {
  function update(i: number, patch: Partial<KeyMoment>) {
    onChange(moments.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }
  function add() {
    const last = moments[moments.length - 1];
    const seconds = last ? last.seconds + 60 : 0;
    onChange([...moments, { seconds, label: "New moment" }]);
  }
  function remove(i: number) {
    onChange(moments.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= moments.length) return;
    const copy = [...moments];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  }

  return (
    <div className="space-y-3">
      <span className="flex items-center gap-1.5 font-display text-sm font-medium text-ink">
        <Clock size={14} aria-hidden /> In this episode
      </span>

      {moments.length === 0 ? (
        <EmptyState>No key moments yet.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {moments.map((m, i) => (
            <li key={i} className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5">
              <span className="font-mono text-[11px] text-muted">#{i + 1}</span>
              <input
                aria-label={`Moment ${i + 1} time (mm:ss)`}
                defaultValue={formatDuration(m.seconds)}
                key={`t-${i}-${m.seconds}`}
                onBlur={(e) => update(i, { seconds: stampToSeconds(e.target.value) })}
                className={`${inputCx} w-24 font-mono`}
              />
              <input
                aria-label={`Moment ${i + 1} label`}
                value={m.label}
                onChange={(e) => update(i, { label: e.target.value })}
                className={`${inputCx} flex-1`}
              />
              <div className="flex">
                <button type="button" aria-label="Move up" onClick={() => move(i, -1)} className="grid h-8 w-8 place-items-center rounded text-muted hover:text-ink">
                  <ArrowUp size={14} aria-hidden />
                </button>
                <button type="button" aria-label="Move down" onClick={() => move(i, 1)} className="grid h-8 w-8 place-items-center rounded text-muted hover:text-ink">
                  <ArrowDown size={14} aria-hidden />
                </button>
                <button type="button" aria-label="Delete moment" onClick={() => remove(i)} className="grid h-8 w-8 place-items-center rounded text-muted hover:text-brand">
                  <Trash2 size={14} aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button type="button" variant="ghost" onClick={add}>
        <Plus size={14} aria-hidden /> Add moment
      </Button>
    </div>
  );
}
