// iTunes categories editor — up to 3 slots, each a category select + a dependent subcategory
// select from the official Apple taxonomy. Empty slots are dropped. Writes PodcastCategory[].
import { inputCx } from "./ui";
import { APPLE_CATEGORIES, APPLE_TOP_CATEGORIES } from "~/lib/apple-categories";
import type { PodcastCategory } from "~/lib/types";

const SLOTS = 3;

export function CategoriesEditor({
  value,
  onChange,
}: {
  value: PodcastCategory[];
  onChange: (next: PodcastCategory[]) => void;
}) {
  // Pad to 3 editable slots.
  const slots: PodcastCategory[] = Array.from({ length: SLOTS }, (_, i) => value[i] ?? { category: "" });

  function update(i: number, patch: Partial<PodcastCategory>) {
    const next = slots.map((s, idx) => (idx === i ? { ...s, ...patch } : s));
    onChange(next.filter((s) => s.category).map((s) => ({ category: s.category, ...(s.subcategory ? { subcategory: s.subcategory } : {}) })));
  }

  return (
    <div className="space-y-2">
      {slots.map((slot, i) => {
        const subs = APPLE_CATEGORIES[slot.category] ?? [];
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="w-5 font-mono text-[11px] text-muted">{i + 1}.</span>
            <select
              aria-label={`Category ${i + 1}`}
              value={slot.category}
              onChange={(e) => update(i, { category: e.target.value, subcategory: undefined })}
              className={inputCx}
            >
              <option value="">none</option>
              {APPLE_TOP_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              aria-label={`Subcategory ${i + 1}`}
              value={slot.subcategory ?? ""}
              disabled={!subs.length}
              onChange={(e) => update(i, { subcategory: e.target.value || undefined })}
              className={`${inputCx} disabled:opacity-50`}
            >
              <option value="">{subs.length ? "no subcategory" : "n/a"}</option>
              {subs.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        );
      })}
      <p className="text-[11px] text-muted">Apple allows up to 3 categories; the first is primary.</p>
    </div>
  );
}
