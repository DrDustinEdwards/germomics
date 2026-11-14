import { readForm } from "@dustinedwards/site-runtime/body";

// Request bodies read to a ceiling (site-runtime ./body), so no form post or upload is held in memory
// past what its route accepts. Over the ceiling, the read throws a 413 for the route to answer with.
const KIB = 1024;
/** A public form: an email, a token, a name and a score. */
export const PUBLIC_FORM = 16 * KIB;
/** An admin form: settings, an episode's transcript and waveform. */
export const ADMIN_FORM = 4 * KIB * KIB;

/** The `token` field of a public form post (a mailed link's confirm button), or null when there is none or it cannot be read. */
export async function formToken(request: Request): Promise<string | null> {
  const form = await readForm(request, PUBLIC_FORM).catch(() => null);
  return form ? String(form.get("token") ?? "") || null : null;
}
