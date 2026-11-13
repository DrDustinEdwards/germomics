// Show hosts editor (show-level byline). Rows of {name, role, img, href}; name required. Persists as Host[] on
// show_config and maps to <podcast:person> in the feed. Capsomer's sortable list draws the rows, their reordering
// (drag, the grip's keys, Move up and down, Alt and an arrow from a field) and Add and Remove.
import { SortableList, useRows } from "capsomer/react/sortable-list";
import { Empty } from "capsomer/react/empty";
import type { Host } from "~/db/schema";

export function HostsEditor({
  hosts,
  onChange,
}: {
  hosts: Host[];
  onChange: (next: Host[]) => void;
}) {
  const rows = useRows(hosts, onChange);
  const update = (i: number, patch: Partial<Host>) =>
    onChange(hosts.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));

  return (
    <SortableList
      aria-label="Hosts"
      layout="stack"
      altKeys
      items={rows.items}
      getId={rows.getId}
      getLabel={(row) => row.value.name || `Host ${row.index + 1}`}
      onReorder={rows.onReorder}
      onRemove={rows.onRemove}
      onAdd={() => onChange([...hosts, { name: "" }])}
      addLabel="Add host"
      empty={<Empty kind="nothing-yet">No hosts yet.</Empty>}
      renderItem={({ value: h, index: i }) => (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              aria-label={`Host ${i + 1} name`}
              placeholder="Name (required)"
              value={h.name}
              onChange={(e) => update(i, { name: e.target.value })}
              className="cap-input flex-1"
            />
            <input
              aria-label={`Host ${i + 1} role`}
              placeholder="Role"
              value={h.role ?? ""}
              onChange={(e) => update(i, { role: e.target.value || undefined })}
              className="cap-input w-40"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              aria-label={`Host ${i + 1} image URL (optional)`}
              placeholder="Image URL"
              value={h.img ?? ""}
              onChange={(e) => update(i, { img: e.target.value || undefined })}
              className="cap-input text-xs"
            />
            <input
              aria-label={`Host ${i + 1} link (optional)`}
              placeholder="Link URL"
              value={h.href ?? ""}
              onChange={(e) => update(i, { href: e.target.value || undefined })}
              className="cap-input text-xs"
            />
          </div>
        </div>
      )}
    />
  );
}
