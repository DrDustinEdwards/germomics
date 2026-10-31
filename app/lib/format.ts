// Pure formatting helpers — framework-agnostic, used by both loaders/feeds (server) and
// components (client). No bindings, no Node APIs.

/** Whole hours, minutes and seconds of a duration; negative, missing or NaN is zero. */
function splitSeconds(totalSeconds?: number | null): [h: number, m: number, s: number] {
  const t = Math.max(0, Math.floor(totalSeconds || 0));
  return [Math.floor(t / 3600), Math.floor((t % 3600) / 60), t % 60];
}

/** "1:02:03" or "4:05" for human display. */
export function formatDuration(totalSeconds?: number | null): string {
  const [h, m, s] = splitSeconds(totalSeconds);
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** "HH:MM:SS" — the form iTunes wants for <itunes:duration>. */
export function formatHMS(totalSeconds?: number | null): string {
  return splitSeconds(totalSeconds).map((n) => String(n).padStart(2, "0")).join(":");
}

/** "June 21, 2026" from an ISO/date string. */
export function formatDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Human-readable spoken duration for screen readers, e.g. "3 minutes 12 seconds". */
export function spokenTime(totalSeconds?: number | null): string {
  const [h, m, s] = splitSeconds(totalSeconds);
  const parts: string[] = [];
  if (h) parts.push(`${h} hour${h === 1 ? "" : "s"}`);
  if (m) parts.push(`${m} minute${m === 1 ? "" : "s"}`);
  if (s || !parts.length) parts.push(`${s} second${s === 1 ? "" : "s"}`);
  return parts.join(" ");
}
