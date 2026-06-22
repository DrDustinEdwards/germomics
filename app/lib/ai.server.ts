// AI authoring assists — server-only (CLAUDE.md rule #1/#2). All Anthropic calls happen here,
// in route actions, via the Workers global `fetch` against the Messages API. ANTHROPIC_API_KEY is
// a Worker secret and must NEVER reach the client bundle. Every generator is grounded in the
// episode transcript only: prompts forbid inventing facts/names/dates/citations. Output is a
// DRAFT — the route returns it, the author accepts/edits/discards (no auto-save, no overwrite).
import type { Chapter } from "~/lib/types";

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

const SYSTEM =
  "You are an editorial assistant for the germomics podcast (microbiology and history). " +
  "You write ONLY from the transcript provided in the user message. Never invent or infer " +
  "facts, names, dates, numbers, citations, quotes, or links that are not explicitly present " +
  "in the transcript. If something is not in the transcript, leave it out. Produce exactly what " +
  "is asked, with no preamble, apologies, or meta-commentary.";

type CallOpts = { system?: string; user: string; maxTokens: number; model?: string };

/** One non-streaming Messages API call. Returns the concatenated text. Throws a friendly Error. */
async function callClaude(env: Env, opts: CallOpts): Promise<string> {
  const key = apiKey(env);
  if (!key) throw new Error("AI is not configured — set the ANTHROPIC_API_KEY worker secret.");

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
    if (res.status === 429) throw new Error("AI rate limit hit — wait a moment and try again.");
    if (res.status === 529) throw new Error("AI service is overloaded — try again shortly.");
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
  if (!t) throw new Error("This episode has no transcript yet — add one first.");
  return t;
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
  const user =
    "Write show notes for this episode as clean HTML. Structure:\n" +
    "1) A 1–2 sentence overview paragraph (<p>).\n" +
    "2) An <h2>Key topics</h2> followed by a <ul> of the main segments/topics actually discussed.\n" +
    "3) Only if specific works, people, or sources are explicitly named in the transcript, add " +
    "<h2>Mentioned</h2> and a <ul> listing them.\n" +
    "Use only these tags: <p>, <h2>, <h3>, <ul>, <li>, <strong>, <em>. Do not include <html>, " +
    "<body>, headings above <h2>, code fences, or any commentary. Invent nothing.\n\n" +
    `Transcript:\n${t}`;
  return callClaude(env, { user, maxTokens: 1600, model });
}

/** Chapter suggestions as Chapter[] (start seconds + title), using real VTT cue timings. */
export async function generateChapters(env: Env, transcript: string, model?: string): Promise<Chapter[]> {
  const t = requireTranscript(transcript);
  const user =
    "From this WebVTT transcript, propose chapter markers at major topic shifts, using the actual " +
    "cue start times. Return ONLY a JSON array (no prose, no code fences) of 4–12 objects: " +
    '[{"startTime": <whole seconds, number>, "title": "<short title, <=60 chars>"}]. ' +
    "The first startTime must be 0 and times must strictly increase. Title each chapter from what " +
    "is actually discussed; invent nothing.\n\n" +
    `Transcript:\n${t}`;
  const raw = await callClaude(env, { user, maxTokens: 1200, model });
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
  const user =
    `Episode working title: "${title || "(untitled)"}".\n` +
    "From the transcript below, write SEO metadata. Return ONLY JSON (no prose, no code fences): " +
    '{"seoTitle": "<=60 chars", "seoDescription": "<=155 chars", "socialBlurb": "<=200 chars, ' +
    'engaging, first-person plural voice"}. Ground every claim in the transcript; invent nothing.\n\n' +
    `Transcript:\n${t}`;
  const raw = await callClaude(env, { user, maxTokens: 600, model });
  const o = extractJson(raw) as Partial<SeoDraft>;
  return {
    seoTitle: String(o.seoTitle ?? "").trim().slice(0, 120),
    seoDescription: String(o.seoDescription ?? "").trim().slice(0, 300),
    socialBlurb: String(o.socialBlurb ?? "").trim().slice(0, 400),
  };
}
