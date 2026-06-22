// Tokenized "preview as published" links (§F). The token is a SHA-256 of a server secret + the
// post id, so a draft/scheduled post can be previewed via an unguessable URL without a login,
// and the link stays stable for a given post. Web Crypto only — no Node deps.

async function tokenFor(env: Env, id: number): Promise<string> {
  const secret = env.BETTER_AUTH_SECRET || "germomics-preview-secret";
  const data = new TextEncoder().encode(`${secret}:preview:${id}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export async function previewToken(env: Env, id: number): Promise<string> {
  return tokenFor(env, id);
}

export async function verifyPreviewToken(env: Env, id: number, token: string): Promise<boolean> {
  if (!token) return false;
  const expected = await tokenFor(env, id);
  // Constant-time-ish compare (lengths are equal hex strings).
  if (token.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}
