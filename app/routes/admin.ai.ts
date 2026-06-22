// AI generation endpoint for the editor's assist buttons. Resource route (action only) under the
// admin.* gate (admin.tsx middleware), so the ANTHROPIC_API_KEY-backed calls are never publicly
// reachable. Returns an editable DRAFT as JSON; it never writes to the database.
import type { Route } from "./+types/admin.ai";
import { getEnv } from "~/lib/context.server";
import { generateShowNotes, generateChapters, generateSeo, aiConfigured } from "~/lib/ai.server";
import { aiCostCapExceeded, recordAiUse } from "~/lib/security.server";

export async function action({ request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  if (!aiConfigured(env)) {
    return Response.json(
      { ok: false, error: "AI is not configured — set the ANTHROPIC_API_KEY worker secret." },
      { status: 503 },
    );
  }

  // Per-day cost cap (in addition to the Worker-layer rate limit): friendly 429 when exceeded so
  // AI spend can't run away. The successful generation below is then recorded against the cap.
  if (await aiCostCapExceeded(env)) {
    return Response.json(
      { ok: false, error: "Daily AI limit reached — try again tomorrow." },
      { status: 429 },
    );
  }

  const form = await request.formData();
  const kind = String(form.get("kind") || "");
  const transcript = String(form.get("transcript") || "");
  const title = String(form.get("title") || "");

  try {
    if (kind === "shownotes") {
      const draft = await generateShowNotes(env, transcript);
      await recordAiUse(env);
      return Response.json({ ok: true, kind, draft });
    }
    if (kind === "chapters") {
      const draft = await generateChapters(env, transcript);
      await recordAiUse(env);
      return Response.json({ ok: true, kind, draft });
    }
    if (kind === "seo") {
      const draft = await generateSeo(env, transcript, title);
      await recordAiUse(env);
      return Response.json({ ok: true, kind, draft });
    }
    return Response.json({ ok: false, error: "Unknown generation kind." }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed.";
    return Response.json({ ok: false, error: message }, { status: 502 });
  }
}
