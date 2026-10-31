// Request bodies read to a ceiling (site-runtime's readCappedBytes), so no form post or upload is held in memory
// past what its route accepts. Over the ceiling, the read throws a 413 for the route to answer with.
import { readCappedBytes } from "@dustinedwards/site-runtime/body";

const KIB = 1024;
/** A public form: an email, a token, a name and a score. */
export const PUBLIC_FORM = 16 * KIB;
/** An admin form: a post body, settings, a transcript sent for drafting. */
export const ADMIN_FORM = 4 * KIB * KIB;

const tooLarge = () => new Response("Payload Too Large", { status: 413, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

async function readBytes(request: Request, max: number): Promise<Uint8Array> {
  const bytes = await readCappedBytes(request, max);
  if (!bytes) throw tooLarge();
  return bytes;
}

/** The request's form, parsed from at most `max` bytes. */
export async function readForm(request: Request, max: number): Promise<FormData> {
  const bytes = await readBytes(request, max);
  return new Response(bytes as Uint8Array<ArrayBuffer>, { headers: { "Content-Type": request.headers.get("Content-Type") ?? "" } }).formData();
}

/** The request's JSON, parsed from at most `max` bytes; null when it is not JSON. */
export async function readJson(request: Request, max: number): Promise<unknown> {
  const text = new TextDecoder().decode(await readBytes(request, max));
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
