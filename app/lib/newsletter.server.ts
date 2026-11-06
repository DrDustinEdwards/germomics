// Newsletter signup with double opt-in. A signup is only a request: the address stays pending (never sent the
// newsletter) until its owner opens the signed link mailed to it, and a signup for an address that unsubscribed does
// not resubscribe it without that confirmation either, so nobody can put someone else's address on the list or undo
// their opt-out (CAN-SPAM, GDPR consent).
//
// The link is site-runtime's signed token over { p, e, at }: `at` is the row's confirm_sent_at, which the confirmation
// must match and then clears, so a link works once, an older link stops working when a newer one is sent, and a used
// link cannot resubscribe the address after a later unsubscribe.
import { and, eq } from "drizzle-orm";
import { readSignedToken, signToken } from "@dustinedwards/site-runtime/signed-token";
import { sendEmail } from "@dustinedwards/site-runtime/email";
import { renderEmail, verification } from "capsomer/email";
import { getDb } from "~/db/index.server";
import { subscribers } from "~/db/schema";
import { SITE_ORIGIN } from "~/lib/site";

const CONFIRM_PATH = "/subscribe/confirm";
const PURPOSE = "subscribe";
const CONFIRM_DAYS = 7;
/** One confirmation mail per address in this window, so the form cannot be used to flood someone's inbox. */
const RESEND_MS = 10 * 60 * 1000;

const keys = (env: Env) => [env.SUBSCRIBE_LINK_KEY];

/**
 * Ask for `email` to join the list: mail it a confirmation link. "sent" also answers an address already on the list or
 * one mailed in the last few minutes (no mail goes; the page says the same either way, so it reveals nothing).
 */
export async function requestSubscription(env: Env, email: string, now = new Date()): Promise<"sent" | "unavailable"> {
  if (!env.SEND_EMAIL || !env.EMAIL_FROM?.trim() || !env.SUBSCRIBE_LINK_KEY) return "unavailable";
  const db = getDb(env);
  const [row] = await db
    .select({ confirmedAt: subscribers.confirmedAt, unsubscribedAt: subscribers.unsubscribedAt, confirmSentAt: subscribers.confirmSentAt })
    .from(subscribers)
    .where(eq(subscribers.email, email))
    .limit(1);
  if (row?.confirmedAt && !row.unsubscribedAt) return "sent";
  if (row?.confirmSentAt && now.getTime() - Date.parse(row.confirmSentAt) < RESEND_MS) return "sent";

  // Only confirm_sent_at changes: a pending row stays pending and an unsubscribed one stays unsubscribed.
  const at = now.toISOString();
  await db
    .insert(subscribers)
    .values({ email, unsubscribeToken: crypto.randomUUID(), confirmSentAt: at })
    .onConflictDoUpdate({ target: subscribers.email, set: { confirmSentAt: at } });

  const token = await signToken(keys(env), { p: PURPOSE, e: email, at });
  const url = `${SITE_ORIGIN}${CONFIRM_PATH}?token=${encodeURIComponent(token)}`;
  const mail = renderEmail(verification, {
    brand: { name: "Germomics", family: "purple" },
    to: email,
    url,
    expiresIn: `${CONFIRM_DAYS} days`,
    copy: {
      subject: "Confirm your Germomics newsletter subscription",
      heading: "Confirm your subscription",
      intro: `Someone asked for the Germomics newsletter to be sent to ${email}. Confirm to start receiving it.`,
      button: "Confirm subscription",
      ignore: "If this was not you, ignore this message. Nothing more is sent to this address unless it is confirmed.",
    },
  });
  const from = { email: env.EMAIL_FROM, name: "Germomics" };
  if (!(await sendEmail(env.SEND_EMAIL, { from, to: email, ...mail }, { secrets: [url, token] })).sent) {
    // Undo the send time, so the person can try again at once rather than being told a mail went.
    await db.update(subscribers).set({ confirmSentAt: row?.confirmSentAt ?? null }).where(eq(subscribers.email, email));
    return "unavailable";
  }
  return "sent";
}

export type Confirmation = { status: "confirm" | "done" | "invalid" | "expired"; email?: string };

/** The address a confirmation link is for, read only (the page's GET: mail scanners open every link). */
export async function checkConfirmation(env: Env, token: string | null, now = new Date()): Promise<Confirmation> {
  return (await inspect(env, token, now)).result;
}

/** Confirm the subscription a link is for (the page's POST): on the list from now, any earlier unsubscribe lifted. */
export async function confirmSubscription(env: Env, token: string | null, now = new Date()): Promise<Confirmation> {
  const { result, claim } = await inspect(env, token, now);
  if (result.status !== "confirm" || !claim) return result;
  const at = now.toISOString();
  const updated = await getDb(env)
    .update(subscribers)
    .set({ confirmedAt: at, consentedAt: at, unsubscribedAt: null, confirmSentAt: null })
    .where(and(eq(subscribers.email, claim.e), eq(subscribers.confirmSentAt, claim.at)))
    .returning({ email: subscribers.email });
  return updated.length ? { status: "done", email: claim.e } : { status: "invalid" };
}

async function inspect(env: Env, token: string | null, now: Date): Promise<{ result: Confirmation; claim?: Claim }> {
  const claim = await readClaim(env, token);
  if (!claim) return { result: { status: "invalid" } };
  if (now.getTime() - Date.parse(claim.at) > CONFIRM_DAYS * 86_400_000) return { result: { status: "expired", email: claim.e } };
  const [row] = await getDb(env)
    .select({ confirmSentAt: subscribers.confirmSentAt, confirmedAt: subscribers.confirmedAt, unsubscribedAt: subscribers.unsubscribedAt })
    .from(subscribers)
    .where(eq(subscribers.email, claim.e))
    .limit(1);
  if (row?.confirmSentAt === claim.at) return { result: { status: "confirm", email: claim.e }, claim };
  // Opened again after confirming: already done. Anything else (a link a newer one replaced, or one used before a later
  // unsubscribe) no longer works.
  if (row?.confirmedAt && !row.unsubscribedAt && !row.confirmSentAt) return { result: { status: "done", email: claim.e } };
  return { result: { status: "invalid" } };
}

type Claim = { e: string; at: string };

async function readClaim(env: Env, token: string | null): Promise<Claim | null> {
  if (!token || !env.SUBSCRIBE_LINK_KEY) return null;
  const payload = await readSignedToken(keys(env), token);
  if (payload?.p !== PURPOSE || typeof payload.e !== "string" || typeof payload.at !== "string") return null;
  return { e: payload.e, at: payload.at };
}
