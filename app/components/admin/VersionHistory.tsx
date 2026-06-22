// Version history (§F): snapshots listed newest-first; pick one to diff against the CURRENT row
// (field-level changes + a line diff of the body) and restore it. Snapshots load on demand from
// /admin/version/:vid so the editor payload stays small.
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import { History, RotateCcw, GitCompare } from "lucide-react";
import { Button, EmptyState } from "./ui";
import { formatDate } from "~/lib/format";
import { diffSnapshots, lineDiff, type FieldChange } from "~/lib/versions";
import type { Post } from "~/db/schema";

type VersionRow = { id: number; createdAt: string };

export function VersionHistory({ versions, current }: { versions: VersionRow[]; current: Post }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const snap = useFetcher<{ snapshot: Post }>();
  const restore = useFetcher();

  useEffect(() => {
    if (openId != null) snap.load(`/admin/version/${openId}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const before = snap.data?.snapshot;
  const changes: FieldChange[] = before ? diffSnapshots(before, current) : [];
  const bodyChange = changes.find((c) => c.label === "Body");
  const fieldChanges = changes.filter((c) => c.label !== "Body");

  if (versions.length === 0) {
    return <EmptyState>No saved versions yet. They’re snapshotted on each save.</EmptyState>;
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {versions.map((v) => (
          <li key={v.id} className="rounded-lg border border-border">
            <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
              <span className="font-mono text-[11px] text-muted">{formatDate(v.createdAt)}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setOpenId(openId === v.id ? null : v.id)}
                  className="inline-flex items-center gap-1 rounded px-2 py-1 font-mono text-[11px] text-accent hover:underline"
                  aria-expanded={openId === v.id}
                >
                  <GitCompare size={12} aria-hidden /> diff
                </button>
                <restore.Form method="post">
                  <input type="hidden" name="intent" value="restore" />
                  <input type="hidden" name="versionId" value={v.id} />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded px-2 py-1 font-mono text-[11px] text-muted hover:text-brand"
                    onClick={(e) => {
                      if (!confirm("Restore this version's content? Current content is snapshotted first.")) e.preventDefault();
                    }}
                  >
                    <RotateCcw size={12} aria-hidden /> restore
                  </button>
                </restore.Form>
              </div>
            </div>

            {openId === v.id ? (
              <div className="border-t border-border bg-surface p-2.5 text-xs">
                {snap.state === "loading" ? (
                  <p className="text-muted">Loading diff…</p>
                ) : before ? (
                  changes.length === 0 ? (
                    <p className="text-muted">No differences from the current version.</p>
                  ) : (
                    <div className="space-y-2">
                      {fieldChanges.length ? (
                        <ul className="space-y-1">
                          {fieldChanges.map((c) => (
                            <li key={c.label}>
                              <span className="font-display font-medium text-ink">{c.label}</span>
                              <div className="mt-0.5 grid gap-0.5">
                                <span className="truncate rounded bg-brand/10 px-1 text-brand line-through">{c.before || "(none)"}</span>
                                <span className="truncate rounded bg-accent/10 px-1 text-accent">{c.after || "(none)"}</span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {bodyChange ? (
                        <details>
                          <summary className="cursor-pointer font-display font-medium text-ink">Body changes</summary>
                          <pre className="mt-1 max-h-60 overflow-auto rounded bg-card p-2 font-mono text-[11px] leading-relaxed">
                            {lineDiff(bodyChange.before, bodyChange.after)
                              .filter((l) => l.type !== "same")
                              .slice(0, 80)
                              .map((l, i) => (
                                <div key={i} className={l.type === "add" ? "text-accent" : "text-brand"}>
                                  {l.type === "add" ? "+ " : "− "}
                                  {l.text}
                                </div>
                              ))}
                          </pre>
                        </details>
                      ) : null}
                    </div>
                  )
                ) : (
                  <p className="text-muted">Couldn’t load this version.</p>
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-1 font-mono text-[11px] text-muted">
        <History size={11} aria-hidden /> Diffs compare a snapshot against the current content.
      </p>
    </div>
  );
}
