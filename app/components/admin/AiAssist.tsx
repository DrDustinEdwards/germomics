// Reusable AI assist control (Tier 3): a "✨ Generate" button → server draft → review panel with
// Accept / Discard. The generated content is always a DRAFT — Accept applies it to the field
// (confirming first if the field already has content); it never auto-saves or silently overwrites.
// Disabled (with a hint) when AI is unconfigured or the episode has no transcript.
import { useState } from "react";
import { Sparkles, Loader2, Check, X, AlertCircle } from "lucide-react";

type Props<T> = {
  kind: "shownotes" | "chapters" | "seo";
  label: string;
  transcript: string;
  title?: string;
  available: boolean;
  hasTranscript: boolean;
  hasExisting: boolean;
  confirmReplaceLabel: string;
  onAccept: (draft: T) => void;
  renderPreview: (draft: T) => React.ReactNode;
};

export function AiAssist<T>({
  kind,
  label,
  transcript,
  title,
  available,
  hasTranscript,
  hasExisting,
  confirmReplaceLabel,
  onAccept,
  renderPreview,
}: Props<T>) {
  const [status, setStatus] = useState<"idle" | "loading" | "review" | "error">("idle");
  const [draft, setDraft] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const disabled = !available || !hasTranscript || status === "loading";
  const hint = !available
    ? "Set the ANTHROPIC_API_KEY worker secret to enable AI assists."
    : !hasTranscript
      ? "Add a transcript first. Generations are grounded in it."
      : "Generate a draft from the transcript (you review before it’s applied).";

  async function generate() {
    setStatus("loading");
    setError(null);
    try {
      const body = new FormData();
      body.set("kind", kind);
      body.set("transcript", transcript);
      if (title) body.set("title", title);
      const res = await fetch("/admin/ai", { method: "POST", body });
      const data = (await res.json()) as { ok: boolean; draft?: T; error?: string };
      if (!data.ok || data.draft === undefined) {
        setError(data.error || "Generation failed.");
        setStatus("error");
        return;
      }
      setDraft(data.draft);
      setStatus("review");
    } catch {
      setError("Could not reach the AI service.");
      setStatus("error");
    }
  }

  function accept() {
    if (draft === undefined || draft === null) return;
    if (hasExisting && !confirm(`Replace the existing ${confirmReplaceLabel} with this draft?`)) return;
    onAccept(draft);
    setStatus("idle");
    setDraft(null);
  }

  return (
    <div className="rounded-xl border border-dashed border-accent/40 bg-accent/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={disabled}
          title={hint}
          className="inline-flex min-h-[2rem] items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 font-display text-xs font-medium text-bg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "loading" ? (
            <Loader2 size={14} className="animate-spin" aria-hidden />
          ) : (
            <Sparkles size={14} aria-hidden />
          )}
          {status === "loading" ? "Generating…" : label}
        </button>
        <span className="text-[11px] text-muted">AI draft · you review before applying</span>
      </div>

      {status === "error" ? (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs font-medium text-brand">
          <AlertCircle size={13} aria-hidden /> {error}
        </p>
      ) : null}

      {status === "review" && draft !== null ? (
        <div className="mt-3 space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted">Draft preview</p>
          <div className="max-h-72 overflow-auto rounded-lg border border-border bg-card p-3">
            {renderPreview(draft)}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={accept}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 font-display text-xs font-medium text-white hover:bg-brand-strong"
            >
              <Check size={13} aria-hidden /> Accept
            </button>
            <button
              type="button"
              onClick={() => {
                setStatus("idle");
                setDraft(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-display text-xs hover:border-brand"
            >
              <X size={13} aria-hidden /> Discard
            </button>
            <span className="text-[11px] text-muted">Accept inserts it as editable content.</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
