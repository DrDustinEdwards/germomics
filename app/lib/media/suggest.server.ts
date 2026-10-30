// Tags and alt text a model suggests for one image (site-api v0.13, mediaSuggestions): Workers AI (the `AI` binding),
// through Cloudflare AI Gateway when AI_GATEWAY_BASE_URL names one, as dustinedwards.info does. Nothing here writes:
// a suggestion reaches the file only when a person accepts it as an alt or a tags write (CLAUDE.md rule 6, AI output is
// drafts only). Each call counts against the site's AI daily cap (security.server.ts). Only Dustin's own uploads are
// sent, never a visitor's data.
import { anthropicRoute } from "@dustinedwards/site-runtime/ai-gateway";
import { editImage } from "@dustinedwards/site-runtime/image";
import { aiCostCapExceeded, recordAiUse } from "~/lib/security.server";

/** The vision model: natively multimodal, Cloudflare-hosted, with no license prompt to accept first. */
const SUGGEST_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

/** The longest edge the model is shown: enough to name what is in a picture, and a small request. */
const VIEW_EDGE = 768;

/** The house rule for alt text: what the picture shows, plainly, and nothing more. */
const PROMPT = [
  "You write alt text and library tags for one picture on a microbiology and history podcast's website.",
  'Answer with JSON only, in this shape: {"alt": "...", "tags": ["...", "..."]}.',
  "alt: one plain sentence, at most 25 words, describing what the picture shows: the subject, what it is doing,",
  "and any text that is legible in it. Say only what can be seen. Do not begin with 'Image of', 'Picture of' or",
  "'Photo of'. Do not interpret, praise or guess at feelings, names, species or places that are not written in the picture.",
  "Do not use em dashes.",
  "tags: three to eight short lower case nouns for what is in the picture, words joined by hyphens, no duplicates.",
].join(" ");

type SuggestEnv = Env & { AI?: Ai; AI_GATEWAY_BASE_URL?: string };

/**
 * The gateway Workers AI runs through: its id from AI_GATEWAY_BASE_URL, the URL site-runtime's ./ai-gateway checks
 * (`.../v1/{account_id}/{gateway_id}/anthropic`), with that module's policy: bodies not logged, the site named on each
 * log entry. Undefined when the site has no gateway: the call goes to Workers AI directly.
 */
function suggestGateway(env: { AI_GATEWAY_BASE_URL?: string }): GatewayOptions | undefined {
  const route = anthropicRoute({ AI_GATEWAY_BASE_URL: env.AI_GATEWAY_BASE_URL }, "germomics");
  if (!route.gateway) return undefined;
  const id = /\/v1\/[^/]+\/([^/]+)\/anthropic$/.exec(route.baseURL)?.[1];
  if (!id) throw new Error("AI_GATEWAY_BASE_URL names no gateway id; set it to https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/anthropic");
  return { id, collectLog: false, metadata: { app: "germomics" } };
}

/** A smaller copy of the picture as a data: URI, for the model to look at. */
async function viewOf(env: SuggestEnv, object: R2ObjectBody): Promise<string> {
  const response = await editImage(env.IMAGES, object.body, { maxEdge: VIEW_EDGE, format: "image/jpeg", quality: 80 });
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

/** The model's answer as tags and alt, from its JSON, wherever in the text it put it. */
function readSuggestion(answer: unknown): { tags: string[]; alt: string | null } {
  const body = typeof answer === "object" && answer !== null && "response" in answer ? (answer as { response: unknown }).response : answer;
  let parsed: unknown = body;
  if (typeof body === "string") {
    const found = /\{[\s\S]*\}/.exec(body)?.[0];
    try {
      parsed = found ? JSON.parse(found) : null;
    } catch {
      parsed = null;
    }
  }
  const record = (parsed ?? {}) as { alt?: unknown; tags?: unknown };
  const alt = typeof record.alt === "string" && record.alt.trim() ? record.alt.trim() : null;
  const tags = Array.isArray(record.tags) ? record.tags.filter((t): t is string => typeof t === "string") : [];
  return { tags, alt };
}

/** What the model suggests for one stored picture. Throws when the site has no AI binding or the day's cap is reached. */
export async function suggestFor(env: SuggestEnv, object: R2ObjectBody): Promise<{ tags: string[]; alt: string | null; model: string }> {
  if (!env.AI) throw new Error("this site has no Workers AI binding (AI), so it cannot suggest tags or alt text");
  if (await aiCostCapExceeded(env)) throw new Error("today's AI cap (the ai.daily_cap setting) is reached");
  const image = await viewOf(env, object);
  const gateway = suggestGateway(env);
  const answer = await env.AI.run(
    SUGGEST_MODEL as keyof AiModels,
    {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
      max_tokens: 300,
      temperature: 0.2,
    } as never,
    gateway ? { gateway } : {},
  );
  await recordAiUse(env);
  return { ...readSuggestion(answer), model: SUGGEST_MODEL };
}
