// The site's one way to send mail: Cloudflare Email Service's send_email binding (SEND_EMAIL), from EMAIL_FROM, both set
// in wrangler.jsonc (germomics.com is onboarded to Email Sending). When either is missing, `emailReady` is false and a
// caller that needs a mail refuses rather than claiming one went.
import type { Rendered } from "capsomer/email";

export function emailReady(env: Env): boolean {
  return Boolean(env.SEND_EMAIL && env.EMAIL_FROM?.trim());
}

/** Send one rendered mail (capsomer/email's renderEmail) to one address. Throws when it cannot be sent. */
export async function sendEmail(env: Env, to: string, mail: Rendered): Promise<void> {
  const from = env.EMAIL_FROM?.trim();
  if (!env.SEND_EMAIL || !from) throw new Error("email is not configured");
  await env.SEND_EMAIL.send({ from: { email: from, name: "Germomics" }, to, subject: mail.subject, text: mail.text, html: mail.html });
}
