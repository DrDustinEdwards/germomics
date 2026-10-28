// AI authoring assists, server-only, on Dustin's Claude subscription. The site never calls a model:
// Anthropic allows subscription sign-in only in Claude Code and its own apps
// (code.claude.com/docs/en/legal-and-compliance), so a draft button fires the germomics drafting
// routine (site-runtime's ./routine) and the routine, a Claude Code session, does the writing.
//
// THE ROUND TRIP. startDraft stores a job in APP_KV (kind, title, transcript and the SHA-256 of a
// one-time key) and fires the routine with only the job's URL and key. The routine GETs the job
// from /api/ai-drafts/:id with the key, writes the draft from the instructions it is given, and
// POSTs it back once; the editor polls /admin/ai?job= until it is ready. A job lives a day.
//
// Every generator is grounded in the episode transcript only: the prompts forbid inventing
// facts/names/dates/citations. Output is a DRAFT: the author accepts/edits/discards (no auto-save,
// no overwrite). Prompts are tunable live from the settings table (ai.prompt.*).
import { safeEqual } from "@dustinedwards/site-runtime/compare";
import { fireRoutine, routineConfig, type RoutineConfig } from "@dustinedwards/site-runtime/routine";
import type { Chapter } from "~/lib/types";
import { loadSettings, loadSnippets, setting, snippet } from "~/lib/content.server";
import { SITE_ORIGIN } from "~/lib/site";

// User-facing AI error strings, resolved from the snippet:ai.error.* content blocks (editable in
// /admin/content) with the in-code fallback via snippet().
export type AiErrors = {
  notConfigured: string;
  rateLimit: string;
  noTranscript: string;
  dailyCap: string;
};
export async function aiErrors(env: Env): Promise<AiErrors> {
  const s = await loadSnippets(env);
  return {
    notConfigured: snippet(s, "snippet:ai.error.not_configured"),
    rateLimit: snippet(s, "snippet:ai.error.rate_limit"),
    noTranscript: snippet(s, "snippet:ai.error.no_transcript"),
    dailyCap: snippet(s, "snippet:ai.error.daily_cap"),
  };
}

function routine(env: Env): RoutineConfig | null {
  const config = routineConfig(env.AI_ROUTINE_URL, env.AI_ROUTINE_TOKEN);
  return "missing" in config ? null : config;
}

/** Is the drafting routine configured? Drives graceful UI degradation (buttons disabled + hint). */
export function aiConfigured(env: Env): boolean {
  return routine(env) !== null;
}

// House writing rule (Vault site-config.md): applies to ALL generated text, so it lives in the
// shared system prompt that every generator (show notes, chapters, SEO) runs through.
export const STYLE_RULE =
  "Writing style (strict): Do NOT use em dashes (the long dash character) anywhere; use commas, " +
  "periods, parentheses, or colons instead. Do not end on a verdict about the episode's worth or " +
  "staying power ('stays with you', 'remains one of the most'), and leave out blurb adjectives " +
  "(unforgettable, haunting, sweeping, poignant, profound). No 'not just X, it's Y' and no " +
  "'it isn't about X, it's about Y'. A list of three only when there are three real things. " +
  "Write plain, direct, varied, human sentences.";

export type AiKind = "shownotes" | "chapters" | "seo";
export const AI_KINDS: readonly AiKind[] = ["shownotes", "chapters", "seo"];
export type SeoDraft = { seoTitle: string; seoDescription: string; socialBlurb: string };
export type Draft = string | Chapter[] | SeoDraft;

type Job = {
  kind: AiKind;
  title: string;
  transcript: string;
  keyHash: string;
  status: "waiting" | "ready" | "failed";
  draft?: Draft;
  error?: string;
};

const JOB_TTL_SECONDS = 24 * 60 * 60;
const jobKey = (id: string) => `ai:job:${id}`;
const JOB_ID = /^[0-9a-f]{32}$/;
const MAX_DRAFT_CHARS = 100_000;

const hex = (bytes: ArrayBuffer | Uint8Array) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (text: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
const randomHex = (n: number) => hex(crypto.getRandomValues(new Uint8Array(n)));

async function readJob(env: Env, id: string): Promise<Job | null> {
  if (!JOB_ID.test(id)) return null;
  return (await env.APP_KV.get<Job>(jobKey(id), "json")) ?? null;
}
const writeJob = (env: Env, id: string, job: Job) => env.APP_KV.put(jobKey(id), JSON.stringify(job), { expirationTtl: JOB_TTL_SECONDS });

/** What the routine is told when it fires: where the job is and the key that opens it, nothing else. */
function fireText(id: string, key: string): string {
  return [`job_url: ${SITE_ORIGIN}/api/ai-drafts/${id}`, `job_key: ${key}`].join("\n");
}

/**
 * Store a drafting job and fire the routine for it. Returns the job id for polling; throws a
 * readable Error when the transcript is empty, the routine is not set up, or the fire fails.
 */
export async function startDraft(env: Env, input: { kind: AiKind; transcript: string; title: string }): Promise<string> {
  const errors = await aiErrors(env);
  const config = routine(env);
  if (!config) throw new Error(errors.notConfigured);
  const transcript = (input.transcript ?? "").trim();
  if (!transcript) throw new Error(errors.noTranscript);
  const id = randomHex(16);
  const key = randomHex(32);
  await writeJob(env, id, { kind: input.kind, title: input.title, transcript, keyHash: await sha256(key), status: "waiting" });
  const fired = await fireRoutine(config, fireText(id, key));
  if (!fired.ok) {
    await env.APP_KV.delete(jobKey(id));
    throw new Error(fired.error.startsWith("429") ? errors.rateLimit : `The drafting routine did not start (${fired.error}).`);
  }
  return id;
}

/** The job as the editor sees it while it polls. */
export async function draftStatus(env: Env, id: string): Promise<{ status: Job["status"] | "gone"; draft?: Draft; error?: string }> {
  const job = await readJob(env, id);
  if (!job) return { status: "gone" };
  return { status: job.status, draft: job.draft, error: job.error };
}

/** The job for the routine, when the key is the job's own. Null for anything else. */
export async function jobForRoutine(env: Env, id: string, key: string): Promise<Job | null> {
  const job = await readJob(env, id);
  if (!job || !(await safeEqual(await sha256(key), job.keyHash))) return null;
  return job;
}

/** The instructions the routine follows for one job: the live prompts from settings, the transcript, and the answer's shape. */
export async function routineInstructions(env: Env, job: Job): Promise<{ kind: AiKind; system: string; prompt: string; answer: string }> {
  const s = await loadSettings(env);
  const system = `${setting(s, "ai.prompt.system")} ${setting(s, "ai.prompt.style")}`.trim();
  const prompt =
    job.kind === "seo"
      ? `Episode working title: "${job.title || "(untitled)"}".\n${setting(s, "ai.prompt.seo")}\n\nTranscript:\n${job.transcript}`
      : `${setting(s, `ai.prompt.${job.kind}`)}\n\nTranscript:\n${job.transcript}`;
  return {
    kind: job.kind,
    system,
    prompt,
    answer: 'POST {"draft": "<your answer exactly as the prompt asks for it, as one string>"} to this URL with the same key. If you cannot write it, POST {"error": "<one sentence why>"} instead.',
  };
}

/**
 * Store the routine's answer for a waiting job: parsed to the kind's shape here, as the API reply
 * was, so a malformed answer fails the job instead of reaching the editor. Returns a refusal
 * message, or null when stored.
 */
export async function finishDraft(env: Env, id: string, job: Job, answer: { draft?: unknown; error?: unknown }): Promise<string | null> {
  if (job.status !== "waiting") return `This job is already ${job.status}.`;
  if (typeof answer.error === "string" && answer.error.trim()) {
    await writeJob(env, id, { ...job, status: "failed", error: `The drafting session could not write it: ${answer.error.trim().slice(0, 300)}` });
    return null;
  }
  if (typeof answer.draft !== "string" || !answer.draft.trim()) return 'Send {"draft": "..."} as a non-empty string, or {"error": "..."}.';
  if (answer.draft.length > MAX_DRAFT_CHARS) return `The draft is over ${MAX_DRAFT_CHARS} characters.`;
  try {
    await writeJob(env, id, { ...job, status: "ready", draft: parseDraft(job.kind, answer.draft) });
  } catch (err) {
    await writeJob(env, id, { ...job, status: "failed", error: err instanceof SyntaxError || !(err instanceof Error) ? "The AI returned an answer that is not valid JSON." : err.message });
  }
  return null;
}

function parseDraft(kind: AiKind, raw: string): Draft {
  if (kind === "shownotes") return raw.trim();
  if (kind === "chapters") return parseChapters(raw);
  return parseSeo(raw);
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

/** Chapter suggestions as Chapter[] (start seconds + title), in order, unusable ones dropped. */
function parseChapters(raw: string): Chapter[] {
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

/** SEO title + meta description + social blurb, capped in length. */
function parseSeo(raw: string): SeoDraft {
  const o = (extractJson(raw) ?? {}) as Partial<SeoDraft>;
  return {
    seoTitle: String(o.seoTitle ?? "").trim().slice(0, 120),
    seoDescription: String(o.seoDescription ?? "").trim().slice(0, 300),
    socialBlurb: String(o.socialBlurb ?? "").trim().slice(0, 400),
  };
}
