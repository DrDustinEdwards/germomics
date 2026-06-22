// Minimal, dependency-free Sentry capture for the Worker. We deliberately avoid the @sentry/*
// SDK to keep the worker lean (CLAUDE.md §07) — this posts a single event to Sentry's store
// endpoint via the global fetch. Best-effort and fire-and-forget (ctx.waitUntil): it must NEVER
// throw into the request path and never changes what the client sees. Server-only.
//
// SENTRY_DSN is a Worker secret (Dustin provides it). When unset, capture is a no-op.

function dsn(env: Env): string | undefined {
  return (env as unknown as { SENTRY_DSN?: string }).SENTRY_DSN || undefined;
}

/** Parse `https://<key>@<host>/<projectId>` into the store URL + auth key. */
function parseDsn(raw: string): { storeUrl: string; key: string } | null {
  try {
    const u = new URL(raw);
    const projectId = u.pathname.replace(/^\//, "");
    if (!u.username || !projectId) return null;
    return {
      storeUrl: `${u.protocol}//${u.host}/api/${projectId}/store/`,
      key: u.username,
    };
  } catch {
    return null;
  }
}

/**
 * Send one error event to Sentry. Schedules the POST on ctx.waitUntil so it doesn't delay the
 * response, and swallows every failure. Sends only the URL/method + error type/message — no
 * request bodies, headers, cookies, or secrets.
 */
export function captureException(
  env: Env,
  error: unknown,
  request: Request,
  ctx: ExecutionContext,
): void {
  const raw = dsn(env);
  if (!raw) return;
  const parsed = parseDsn(raw);
  if (!parsed) return;

  const err = error instanceof Error ? error : new Error(String(error));
  const url = new URL(request.url);
  const event = {
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: Date.now() / 1000,
    platform: "javascript",
    level: "error",
    logger: "worker",
    transaction: url.pathname,
    server_name: url.host,
    request: { url: url.href, method: request.method },
    tags: { runtime: "cloudflare-workers" },
    exception: {
      values: [
        {
          type: err.name || "Error",
          value: err.message || "Unknown error",
          ...(err.stack ? { stacktrace: { frames: [{ function: err.stack.split("\n")[0] }] } } : {}),
        },
      ],
    },
  };

  const send = fetch(parsed.storeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${parsed.key}, sentry_client=germomics-worker/1.0`,
    },
    body: JSON.stringify(event),
  })
    .then(() => undefined)
    .catch(() => undefined);

  try {
    ctx.waitUntil(send);
  } catch {
    /* no ctx — let it run detached */
  }
}
