// Tokenized "preview as published" links (§F). The token is an HMAC-SHA-256 of the post id under
// the server secret, so a draft/scheduled post can be previewed via an unguessable URL without a
// login, and the link stays stable for a given post. With no secret there is no token at all: a
// fixed fallback in a public file would let anyone mint one (Grok audit 2026-10-21, GE-2).
// Web Crypto only — no Node deps.

async function tokenFor(env: Env, id: number): Promise<string | null> {
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`preview:${id}`));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

/** The post's preview token, or null when the Worker has no secret to sign it with. */
export async function previewToken(env: Env, id: number): Promise<string | null> {
  return tokenFor(env, id);
}

export async function verifyPreviewToken(env: Env, id: number, token: string): Promise<boolean> {
  if (!token) return false;
  const expected = await tokenFor(env, id);
  if (!expected) return false;
  // Constant-time-ish compare (lengths are equal hex strings).
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
