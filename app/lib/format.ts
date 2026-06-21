// Pure formatting helpers — framework-agnostic, used by both loaders/feeds (server) and
// components (client). No bindings, no Node APIs.

/** "1:02:03" or "4:05" for human display. */
export function formatDuration(totalSeconds?: number | null): string {
  if (!totalSeconds || totalSeconds < 0) return "0:00";
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** "HH:MM:SS" — the form iTunes wants for <itunes:duration>. */
export function formatHMS(totalSeconds?: number | null): string {
  const t = Math.max(0, Math.floor(totalSeconds ?? 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
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

/** RFC-822 date, required by RSS <pubDate>. */
export function rfc822(value?: string | null): string {
  if (!value) return new Date(0).toUTCString();
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  return (Number.isNaN(d.getTime()) ? new Date(0) : d).toUTCString();
}

/** "mm:ss" / "h:mm:ss" timestamp ↔ seconds, for transcript cues and share-at-timestamp. */
export function secondsToStamp(seconds: number): string {
  return formatDuration(seconds);
}

export function stampToSeconds(stamp: string): number {
  const parts = stamp.split(":").map(Number);
  if (parts.some((n) => Number.isNaN(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

/** XML-escape text destined for a feed. */
export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
