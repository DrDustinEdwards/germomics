// Reusable AI assist control (Tier 3): a "✨ Generate" button starts a drafting session on the
// Claude subscription (app/lib/ai.server.ts), the control polls until the draft is back, then a
// review panel with Accept / Discard. The generated content is always a DRAFT — Accept applies it to the field
// (confirming first if the field already has content); it never auto-saves or silently overwrites.
// Disabled (with a hint) when AI is unconfigured or the episode has no transcript.
import { useEffect, useRef, useState } from "react";
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

const POLL_MS = 10_000;
const POLL_LIMIT_MS = 20 * 60_000;

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
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  const disabled = !available || !hasTranscript || status === "loading";
  const hint = !available
    ? "Set the AI_ROUTINE_URL and AI_ROUTINE_TOKEN worker secrets to enable AI drafts."
    : !hasTranscript
      ? "Add a transcript first. Generations are grounded in it."
      : "Generate a draft from the transcript (you review before it’s applied).";

  async function generate() {
    setStatus("loading");
    setError(null);
    const fail = (message: string) => {
      if (!alive.current) return;
      setError(message);
      setStatus("error");
    };
    try {
      const body = new FormData();
      body.set("kind", kind);
      body.set("transcript", transcript);
      if (title) body.set("title", title);
      const res = await fetch("/admin/ai", { method: "POST", body });
      const started = (await res.json()) as { ok: boolean; job?: string; error?: string };
      if (!started.ok || !started.job) return fail(started.error || "Drafting failed.");
      // A drafting session takes a few minutes; poll until it answers or the wait runs out.
      for (let waited = 0; waited < POLL_LIMIT_MS && alive.current; waited += POLL_MS) {
        await new Promise((r) => setTimeout(r, POLL_MS));
        const poll = await fetch(`/admin/ai?job=${started.job}`).then((r) => r.json() as Promise<{ status?: string; draft?: T; error?: string }>).catch(() => null);
        if (!poll || poll.status === "waiting") continue;
        if (poll.status === "ready" && poll.draft !== undefined) {
          if (!alive.current) return;
          setDraft(poll.draft);
          setStatus("review");
          return;
        }
        return fail(poll.error || "The draft was lost. Try again.");
      }
      fail("The drafting session has not answered after 20 minutes. Try again later.");
    } catch {
      fail("Could not reach the site.");
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
          {status === "loading" ? "Drafting, a few minutes…" : label}
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
