// AI drafting endpoint for the editor's assist buttons. Resource route under the admin.* gate
// (admin.tsx middleware), so only the admin can start a drafting session on the subscription.
// POST starts a job and returns its id; GET ?job= is what the editor polls until the draft is
// ready. It never writes to a post: the author accepts or discards the draft.
import type { Route } from "./+types/admin.ai";
import { getEnv } from "~/lib/context.server";
import { AI_KINDS, aiConfigured, aiErrors, draftStatus, startDraft, type AiKind } from "~/lib/ai.server";
import { aiCostCapExceeded, recordAiUse } from "~/lib/security.server";
import { ADMIN_FORM, readForm } from "~/lib/body.server";

const noStore = { "Cache-Control": "no-store" };

export async function loader({ request, context }: Route.LoaderArgs) {
  const id = new URL(request.url).searchParams.get("job") ?? "";
  return Response.json({ ok: true, ...(await draftStatus(getEnv(context), id)) }, { headers: noStore });
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const errors = await aiErrors(env);
  if (!aiConfigured(env)) {
    return Response.json({ ok: false, error: errors.notConfigured }, { status: 503 });
  }

  // Per-day cap (in addition to the Worker-layer rate limit): each fire is a session on the
  // subscription, so a stuck button cannot start an unbounded number of them.
  if (await aiCostCapExceeded(env)) {
    return Response.json({ ok: false, error: errors.dailyCap }, { status: 429 });
  }

  const form = await readForm(request, ADMIN_FORM);
  const kind = String(form.get("kind") || "") as AiKind;
  if (!AI_KINDS.includes(kind)) return Response.json({ ok: false, error: "Unknown generation kind." }, { status: 400 });
  try {
    const job = await startDraft(env, { kind, transcript: String(form.get("transcript") || ""), title: String(form.get("title") || "") });
    await recordAiUse(env);
    return Response.json({ ok: true, kind, job });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : "Drafting failed." }, { status: 502 });
  }
}
