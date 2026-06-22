// Visual chapters editor (§D): rows of timestamp + title + optional image + optional link.
// Set the time by typing mm:ss or clicking the waveform (sets the selected row). Add / reorder /
// delete, with a monotonic-time warning. Raw-JSON tab writes the same structured store. Persists
// as Chapter[] (served as the Podcasting 2.0 JSON file by /:slug/chapters.json).
import { useMemo, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, ListOrdered } from "lucide-react";
import { Tabs, Button, inputCx, EmptyState } from "./ui";
import { Waveform } from "./Waveform";
import { formatDuration, stampToSeconds } from "~/lib/format";
import type { Chapter } from "~/lib/types";

export function ChaptersEditor({
  chapters,
  onChange,
  peaks,
  duration,
}: {
  chapters: Chapter[];
  onChange: (next: Chapter[]) => void;
  peaks: number[];
  duration: number | null;
}) {
  const [tab, setTab] = useState<"visual" | "json">("visual");
  const [selected, setSelected] = useState(0);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(chapters, null, 2));
  const [jsonErr, setJsonErr] = useState<string | null>(null);

  const monotonic = useMemo(
    () => chapters.every((c, i) => i === 0 || c.start > chapters[i - 1].start),
    [chapters],
  );

  function update(i: number, patch: Partial<Chapter>) {
    onChange(chapters.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }
  function add() {
    const last = chapters[chapters.length - 1];
    const start = last ? last.start + 60 : 0;
    onChange([...chapters, { start, title: "New chapter" }]);
    setSelected(chapters.length);
  }
  function remove(i: number) {
    onChange(chapters.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= chapters.length) return;
    const copy = [...chapters];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-display text-sm font-medium text-ink">
          <ListOrdered size={14} aria-hidden /> Chapters
        </span>
        <Tabs
          label="Chapters input method"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "visual", label: "Visual" },
            { value: "json", label: "Raw JSON" },
          ]}
        />
      </div>

      {tab === "visual" ? (
        <>
          {peaks.length ? (
            <div>
              <Waveform
                peaks={peaks}
                markers={duration ? chapters.map((c) => Math.min(1, c.start / duration)) : []}
                ariaLabel="Scrub to set the selected chapter time"
                onScrub={(f) => {
                  if (!duration || !chapters.length) return;
                  update(selected, { start: Math.round(f * duration) });
                }}
              />
              <p className="mt-1 text-[11px] text-muted">
                Click the waveform to set chapter #{selected + 1}’s time.
              </p>
            </div>
          ) : null}

          {chapters.length === 0 ? (
            <EmptyState>No chapters yet.</EmptyState>
          ) : (
            <ul className="space-y-2">
              {chapters.map((c, i) => (
                <li
                  key={i}
                  onFocusCapture={() => setSelected(i)}
                  className={`rounded-xl border p-2.5 ${
                    selected === i ? "border-accent bg-accent/5" : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted">#{i + 1}</span>
                    <input
                      aria-label={`Chapter ${i + 1} time (mm:ss)`}
                      defaultValue={formatDuration(c.start)}
                      key={`t-${i}-${c.start}`}
                      onBlur={(e) => update(i, { start: stampToSeconds(e.target.value) })}
                      className={`${inputCx} w-24 font-mono`}
                    />
                    <input
                      aria-label={`Chapter ${i + 1} title`}
                      value={c.title}
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
                      <button type="button" aria-label="Delete chapter" onClick={() => remove(i)} className="grid h-8 w-8 place-items-center rounded text-muted hover:text-brand">
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      aria-label={`Chapter ${i + 1} image URL (optional)`}
                      placeholder="image URL (optional)"
                      value={c.img ?? ""}
                      onChange={(e) => update(i, { img: e.target.value || undefined })}
                      className={`${inputCx} text-xs`}
                    />
                    <input
                      aria-label={`Chapter ${i + 1} link (optional)`}
                      placeholder="link URL (optional)"
                      value={c.url ?? ""}
                      onChange={(e) => update(i, { url: e.target.value || undefined })}
                      className={`${inputCx} text-xs`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!monotonic ? (
            <p role="alert" className="text-xs font-medium text-brand">
              Chapter times must increase in order — reorder or fix the timestamps.
            </p>
          ) : null}

          <Button type="button" variant="ghost" onClick={add}>
            <Plus size={14} aria-hidden /> Add chapter
          </Button>
        </>
      ) : (
        <div className="space-y-2">
          <textarea
            value={jsonText}
            rows={10}
            spellCheck={false}
            onChange={(e) => {
              setJsonText(e.target.value);
              try {
                const parsed = JSON.parse(e.target.value) as Chapter[];
                if (!Array.isArray(parsed)) throw new Error("must be an array");
                setJsonErr(null);
                onChange(parsed);
              } catch (err) {
                setJsonErr(err instanceof Error ? err.message : "invalid JSON");
              }
            }}
            className={`${inputCx} font-mono text-xs`}
          />
          {jsonErr ? <p role="alert" className="text-xs text-brand">JSON error: {jsonErr}</p> : null}
        </div>
      )}
    </div>
  );
}
