// Request bodies read to a ceiling (site-runtime ./body), so no form post or upload is held in memory
// past what its route accepts. Over the ceiling, the read throws a 413 for the route to answer with.
const KIB = 1024;
/** A public form: an email, a token, a name and a score. */
export const PUBLIC_FORM = 16 * KIB;
/** An admin form: settings, an episode's transcript and waveform. */
export const ADMIN_FORM = 4 * KIB * KIB;

// The form reader is site-runtime's ./body (a thrown 413 over the ceiling).
export { readForm } from "@dustinedwards/site-runtime/body";
