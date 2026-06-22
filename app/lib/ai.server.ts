// AI authoring assists — server-only (CLAUDE.md rule #1/#2). All Anthropic calls happen here,
// in route actions, via the Workers global `fetch` against the Messages API. ANTHROPIC_API_KEY is
// a Worker secret and must NEVER reach the client bundle. Every generator is grounded in the
// episode transcript only: prompts forbid inventing facts/names/dates/citations. Output is a
// DRAFT — the route returns it, the author accepts/edits/discards (no auto-save, no overwrite).
import type { Chapter } from "~/lib/types";
import { loadSettings, setting } from "~/lib/content.server";

// Default model is configurable; sonnet-4-6 balances quality/cost for summarization. Haiku is the
// cheaper/faster option. (Per the Tier 3 spec — these exact model strings.)
const DEFAULT_MODEL = "claude-sonnet-4-6";
export const AI_MODELS = {
  default: DEFAULT_MODEL,
  cheap: "claude-haiku-4-5-20251001",
} as const;

const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

function apiKey(env: Env): string | undefined {
  return (env as unknown as { ANTHROPIC_API_KEY?: string }).ANTHROPIC_API_KEY || undefined;
}

/** Is the AI key configured? Drives graceful UI degradation (buttons disabled + hint). */
export function aiConfigured(env: Env): boolean {
  return !!apiKey(env);
}

// House writing rule (Vault site-config.md): applies to ALL generated text, so it lives in the
// shared system prompt that every generator (show notes, chapters, SEO) runs through.
export const STYLE_RULE =
  "Writing style (strict): Do NOT use em dashes (the long dash character) anywhere; use commas, " +
  "periods, parentheses, or colons instead. Avoid AI-writing tells such as: delve, tapestry, " +
  "spans, landscape, realm, navigate, testament to, boasts, stands as, the phrasing 'not just X, " +
  "it's Y', overwrought three-item lists, and grandiose closing sentences. Write plain, direct, " +
  "varied, human sentences.";

const SYSTEM =
  "You are an editorial assistant for the germomics podcast (microbiology and history). " +
  "You write ONLY from the transcript provided in the user message. Never invent or infer " +
  "facts, names, dates, numbers, citations, quotes, or links that are not explicitly present " +
  "in the transcript. If something is not in the transcript, leave it out. Produce exactly what " +
  "is asked, with no preamble, apologies, or meta-commentary. " +
  STYLE_RULE;

type CallOpts = { system?: string; user: string; maxTokens: number; model?: string };

/** One non-streaming Messages API call. Returns the concatenated text. Throws a friendly Error. */
async function callClaude(env: Env, opts: CallOpts): Promise<string> {
  const key = apiKey(env);
  if (!key) throw new Error("AI is not configured. Set the ANTHROPIC_API_KEY worker secret.");

  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: opts.model || DEFAULT_MODEL,
        max_tokens: opts.maxTokens,
        system: opts.system ?? SYSTEM,
        messages: [{ role: "user", content: opts.user }],
      }),
    });
  } catch {
    throw new Error("Could not reach the AI service. Check your connection and try again.");
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      detail = body.error?.message ?? "";
    } catch {
      /* ignore non-JSON error bodies */
    }
    if (res.status === 401) throw new Error("ANTHROPIC_API_KEY is invalid or revoked.");
    if (res.status === 429) throw new Error("AI rate limit hit. Wait a moment and try again.");
    if (res.status === 529) throw new Error("AI service is overloaded. Try again shortly.");
    throw new Error(`AI request failed (${res.status})${detail ? `: ${detail}` : ""}.`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return (data.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("")
    .trim();
}

function requireTranscript(transcript: string): string {
  const t = (transcript ?? "").trim();
  if (!t) throw new Error("This episode has no transcript yet. Add one first.");
  return t;
}

// Model + prompts are tunable live from the settings table (ai.model, ai.prompt.*). Each read
// falls back to the generated default (content-defaults.ts) via setting(), so editing a prompt in
// D1 changes generation with no deploy, and a missing row never breaks it.
async function aiCfg(env: Env) {
  const s = await loadSettings(env);
  return {
    model: setting(s, "ai.model", DEFAULT_MODEL),
    system: `${setting(s, "ai.prompt.system")} ${setting(s, "ai.prompt.style")}`.trim(),
    shownotes: setting(s, "ai.prompt.shownotes"),
    chapters: setting(s, "ai.prompt.chapters"),
    seo: setting(s, "ai.prompt.seo"),
  };
}

// Pull the first JSON value out of a model response (tolerates code fences / stray prose).
function extractJson(text: string): unknown {
  let s = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const firstObj = s.indexOf("{");
  const firstArr = s.indexOf("[");
  const start =
    firstArr === -1 ? firstObj : firstObj === -1 ? firstArr : Math.min(firstObj, firstArr);
  if (start > 0) s = s.slice(start);
  const lastObj = s.lastIndexOf("}");
  const lastArr = s.lastIndexOf("]");
  const end = Math.max(lastObj, lastArr);
  if (end >= 0) s = s.slice(0, end + 1);
  return JSON.parse(s);
}

/** Show-notes draft as sanitized-friendly HTML, grounded in the transcript. */
export async function generateShowNotes(env: Env, transcript: string, model?: string): Promise<string> {
  const t = requireTranscript(transcript);
  const cfg = await aiCfg(env);
  const user = `${cfg.shownotes}\n\nTranscript:\n${t}`;
  return callClaude(env, { system: cfg.system, user, maxTokens: 1800, model: model || cfg.model });
}

/** Chapter suggestions as Chapter[] (start seconds + title), using real VTT cue timings. */
export async function generateChapters(env: Env, transcript: string, model?: string): Promise<Chapter[]> {
  const t = requireTranscript(transcript);
  const cfg = await aiCfg(env);
  const user = `${cfg.chapters}\n\nTranscript:\n${t}`;
  const raw = await callClaude(env, { system: cfg.system, user, maxTokens: 1200, model: model || cfg.model });
  const parsed = extractJson(raw);
  if (!Array.isArray(parsed)) throw new Error("The AI returned an unexpected chapters format.");
  const chapters: Chapter[] = parsed
    .map((c) => {
      const o = c as { startTime?: unknown; start?: unknown; title?: unknown };
      const start = Math.max(0, Math.floor(Number(o.startTime ?? o.start)));
      const title = String(o.title ?? "").trim();
      return Number.isFinite(start) && title ? { start, title } : null;
    })
    .filter((c): c is Chapter => c !== null)
    .sort((a, b) => a.start - b.start);
  if (!chapters.length) throw new Error("The AI didn’t return any usable chapters.");
  return chapters;
}

export type SeoDraft = { seoTitle: string; seoDescription: string; socialBlurb: string };

/** SEO title + meta description + optional social blurb, grounded in the transcript. */
export async function generateSeo(
  env: Env,
  transcript: string,
  title: string,
  model?: string,
): Promise<SeoDraft> {
  const t = requireTranscript(transcript);
  const cfg = await aiCfg(env);
  const user = `Episode working title: "${title || "(untitled)"}".\n${cfg.seo}\n\nTranscript:\n${t}`;
  const raw = await callClaude(env, { system: cfg.system, user, maxTokens: 600, model: model || cfg.model });
  const o = extractJson(raw) as Partial<SeoDraft>;
  return {
    seoTitle: String(o.seoTitle ?? "").trim().slice(0, 120),
    seoDescription: String(o.seoDescription ?? "").trim().slice(0, 300),
    socialBlurb: String(o.socialBlurb ?? "").trim().slice(0, 400),
  };
}
