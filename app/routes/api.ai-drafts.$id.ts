// The drafting routine's side of a job (app/lib/ai.server.ts). Outside /admin because the routine
// is a Claude Code session, not the admin's browser; each job opens only with its own one-time key,
// sent as a bearer token. GET hands the routine the instructions and transcript, POST takes the
// draft back once.
import type { Route } from "./+types/api.ai-drafts.$id";
import { getEnv } from "~/lib/context.server";
import { finishDraft, jobForRoutine, routineInstructions } from "~/lib/ai.server";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
const bearer = (request: Request) => /^Bearer (\S+)$/.exec(request.headers.get("Authorization") ?? "")?.[1] ?? "";
const NO_JOB = "No job here opens with that key.";

export async function loader({ request, params, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const job = await jobForRoutine(env, params.id, bearer(request));
  if (!job) return json({ ok: false, error: NO_JOB }, 404);
  if (job.status !== "waiting") return json({ ok: false, error: `This job is already ${job.status}.` }, 409);
  return json({ ok: true, ...(await routineInstructions(env, job)) });
}

export async function action({ request, params, context }: Route.ActionArgs) {
  if (request.method !== "POST") return json({ ok: false, error: "POST only." }, 405);
  const env = getEnv(context);
  const job = await jobForRoutine(env, params.id, bearer(request));
  if (!job) return json({ ok: false, error: NO_JOB }, 404);
  const answer = (await request.json().catch(() => null)) as { draft?: unknown; error?: unknown } | null;
  if (!answer || typeof answer !== "object") return json({ ok: false, error: 'Send JSON: {"draft": "..."} or {"error": "..."}.' }, 400);
  const refused = await finishDraft(env, params.id, job, answer);
  if (refused) return json({ ok: false, error: refused }, refused.startsWith("This job is already") ? 409 : 400);
  return json({ ok: true });
}
