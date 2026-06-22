// Shared rich body editor (§B). Lazy-loads TipTap on the client only (kept out of the SSR/shared
// bundle — CLAUDE.md rule #7) and offers a "Rich / HTML" toggle: the rich surface (TipTap) and a
// raw-HTML textarea are two views of the same value, the dual-input idea applied to the body.
import { Suspense, lazy, useEffect, useState } from "react";
import { Pencil, Code } from "lucide-react";
import { Tabs } from "./ui";

const TipTapBody = lazy(() => import("./TipTapBody"));

export function RichTextEditor({
  value,
  onChange,
  postId,
}: {
  value: string;
  onChange: (html: string) => void;
  postId: number | string;
}) {
  const [mode, setMode] = useState<"rich" | "html">("rich");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-sm font-medium text-ink">Body</span>
        <Tabs
          label="Body editor mode"
          value={mode}
          onChange={setMode}
          tabs={[
            { value: "rich", label: "Rich", icon: <Pencil size={13} aria-hidden /> },
            { value: "html", label: "HTML", icon: <Code size={13} aria-hidden /> },
          ]}
        />
      </div>

      {mode === "rich" ? (
        mounted ? (
          <Suspense
            fallback={<div className="min-h-[24rem] rounded-xl border border-border bg-card" aria-busy />}
          >
            <TipTapBody value={value} onChange={onChange} postId={postId} />
          </Suspense>
        ) : (
          <div className="min-h-[24rem] rounded-xl border border-border bg-card" aria-hidden />
        )
      ) : (
        <textarea
          value={value}
          rows={20}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-3 py-2 font-mono text-xs leading-relaxed text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
        />
      )}
      <p className="text-[11px] text-muted">
        Pasted Google-Docs / Word content is cleaned automatically. HTML is sanitized on save.
      </p>
    </div>
  );
}
