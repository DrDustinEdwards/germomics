// Client-safe version-history diffing. post_versions stores a full Post snapshot; these helpers
// turn two snapshots into a human-readable field-level diff plus a line diff for the body.
import type { Post } from "~/db/schema";

export type FieldChange = { label: string; before: string; after: string };

type Snap = Partial<Post> & Record<string, unknown>;

function asText(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// Order + labels for the fields worth surfacing in history.
const FIELDS: Array<[keyof Post, string]> = [
  ["title", "Title"],
  ["slug", "Slug"],
  ["status", "Status"],
  ["publishAt", "Publish at"],
  ["excerpt", "Excerpt"],
  ["tags", "Tags"],
  ["coverImage", "Cover image"],
  ["coverAlt", "Cover alt"],
  ["ogImage", "Social image"],
  ["seoTitle", "SEO title"],
  ["seoDescription", "SEO description"],
  ["episodeNumber", "Episode #"],
  ["seasonNumber", "Season"],
  ["episodeType", "Episode type"],
  ["audioUrl", "Audio URL"],
  ["audioDuration", "Duration"],
  ["transcript", "Transcript"],
  ["chapters", "Chapters"],
  ["guests", "Guests (legacy)"],
  ["body", "Body"],
];

/** Field-level changes between an older snapshot `a` and a newer one `b`. */
export function diffSnapshots(a: Snap, b: Snap): FieldChange[] {
  const out: FieldChange[] = [];
  for (const [key, label] of FIELDS) {
    const before = asText(a[key]);
    const after = asText(b[key]);
    if (before !== after) out.push({ label, before, after });
  }
  return out;
}

export type DiffLine = { type: "same" | "add" | "del"; text: string };

/** Minimal LCS line diff for the body field. */
export function lineDiff(beforeText: string, afterText: string): DiffLine[] {
  const a = beforeText.split("\n");
  const b = afterText.split("\n");
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "del", text: a[i++] });
    } else {
      out.push({ type: "add", text: b[j++] });
    }
  }
  while (i < n) out.push({ type: "del", text: a[i++] });
  while (j < m) out.push({ type: "add", text: b[j++] });
  return out;
}
