/**
 * The API LEG: this Worker to germomics.com.
 *
 * The ONLY way this Worker reaches Germomics: one authenticated POST to /api/operator on the `germomics` Worker over
 * the SITE service binding (app/routes/api.operator.ts), body `{ tool, args }`. That route owns every rule: the bearer
 * check, its rate limit and the tool's own work. Nothing here interprets a rule. A service binding is still HTTP, not
 * an in-process call: the request crosses the same authentication any other operator call does.
 *
 * The credential here, OPERATOR_TOKEN, identifies WHAT this Worker may do. It is never the client's OAuth token (no
 * token passthrough, rule 12.2).
 */

import { ApiLegError, callApi } from "@dustinedwards/site-runtime/mcp-server";

export interface ApiEnv {
  /** Service binding to the `germomics` Worker. The only route to the app. */
  SITE: Fetcher;
  /** The URL the bound Worker sees. A service binding ignores the host; the app reads its own URL. */
  SITE_ORIGIN: string;
  /** The API leg bearer. Same value as the germomics Worker's OPERATOR_TOKEN secret. At least 32 characters. */
  OPERATOR_TOKEN: string;
}

export interface ApiCallResult {
  /** HTTP status the API returned. */
  status: number;
  /** True for a 2xx answer with ok: true. */
  ok: boolean;
  /** On success, the API's data. */
  data?: unknown;
  /** On failure, the API's message VERBATIM. Never summarized or softened. */
  error?: string;
}

export { ApiLegError };

const LEG = {
  binding: "SITE",
  token: "OPERATOR_TOKEN",
  api: "The Germomics operator API",
  userAgent: "germomics-admin-mcp/0.1",
};

/** One operator tool call. A transport, not a translator: the API's answer comes back as it was sent. */
export async function callOperator(
  env: Partial<ApiEnv>,
  tool: string,
  args: Record<string, unknown>,
  options: { signal?: AbortSignal } = {},
): Promise<ApiCallResult> {
  // The call's abort signal (checklist P11): a client that closes the stream stops the request to the API.
  const { status, ok, body } = await callApi(env, LEG, "/api/operator", { json: { tool, args }, signal: options.signal });
  const answer = body as { ok?: unknown; data?: unknown; error?: unknown } | null;
  if (ok && answer?.ok === true) return { status, ok: true, data: answer.data };
  return {
    status,
    ok: false,
    error: typeof answer?.error === "string" ? answer.error : `The Germomics operator API refused with status ${status}.`,
  };
}
