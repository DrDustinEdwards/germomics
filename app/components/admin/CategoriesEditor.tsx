// iTunes categories editor: up to three rows, each a category select and a dependent subcategory select from the
// official Apple taxonomy, in order (the first is primary). Capsomer's sortable list draws the rows, their reordering
// and Add and Remove. A row with no category yet is kept here and dropped when the form is saved.
import { SortableList, useRows } from "capsomer/react/sortable-list";
import { inputCx } from "./ui";
import { APPLE_CATEGORIES, APPLE_TOP_CATEGORIES } from "~/lib/apple-categories";
import type { PodcastCategory } from "~/lib/types";

/** Apple reads at most three. */
const MAX = 3;

export function CategoriesEditor({
  value,
  onChange,
}: {
  value: PodcastCategory[];
  onChange: (next: PodcastCategory[]) => void;
}) {
  const rows = useRows(value, onChange);
  const update = (i: number, next: PodcastCategory) =>
    onChange(value.map((c, idx) => (idx === i ? next : c)));

  return (
    <div className="space-y-2">
      <SortableList
        aria-label="iTunes categories"
        layout="stack"
        altKeys
        max={MAX}
        items={rows.items}
        getId={rows.getId}
        getLabel={(row) => row.value.category || `Category ${row.index + 1}`}
        onReorder={rows.onReorder}
        onRemove={rows.onRemove}
        onAdd={() => onChange([...value, { category: "" }])}
        addLabel="Add category"
        renderItem={(row) => {
          const slot = row.value;
          const i = row.index;
          const subs = APPLE_CATEGORIES[slot.category] ?? [];
          return (
            <div className="flex items-center gap-2">
              <select
                aria-label={`Category ${i + 1}`}
                value={slot.category}
                onChange={(e) => update(i, { category: e.target.value })}
                className={inputCx}
              >
                <option value="">none</option>
                {APPLE_TOP_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                aria-label={`Subcategory ${i + 1}`}
                value={slot.subcategory ?? ""}
                disabled={!subs.length}
                onChange={(e) =>
                  update(i, {
                    category: slot.category,
                    ...(e.target.value ? { subcategory: e.target.value } : {}),
                  })
                }
                className={`${inputCx} disabled:opacity-50`}
              >
                <option value="">{subs.length ? "no subcategory" : "n/a"}</option>
                {subs.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          );
        }}
      />
      <p className="text-[0.6875rem] text-muted">
        Apple allows up to 3 categories; the first is primary.
      </p>
    </div>
  );
}
