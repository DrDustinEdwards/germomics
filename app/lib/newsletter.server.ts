// Double opt-in over `subscribers` (site-runtime's ./newsletter): an address stays pending until its owner opens the mailed signed link, and an unsubscribed one needs that confirmation too.
import { and, eq, isNull } from "drizzle-orm";
import {
  newsletter,
  type Confirmation,
  type SubscriberStore,
} from "@dustinedwards/site-runtime/newsletter";
import { sendEmail } from "@dustinedwards/site-runtime/email";
import { renderEmail, verification } from "capsomer/email";
import { getDb } from "~/db/index.server";
import { subscribers } from "~/db/schema";
import { SITE_ORIGIN } from "~/lib/site";

export type { Confirmation };

function store(env: Env): SubscriberStore {
  const db = getDb(env);
  return {
    async find(email) {
      const [row] = await db
        .select({
          confirmedAt: subscribers.consentedAt,
          unsubscribedAt: subscribers.unsubscribedAt,
          confirmSentAt: subscribers.confirmSentAt,
        })
        .from(subscribers)
        .where(eq(subscribers.email, email))
        .limit(1);
      return row ?? null;
    },
    async upsertPending(email, confirmSentAt) {
      // Only confirm_sent_at changes: a pending row stays pending and an unsubscribed one stays unsubscribed.
      await db
        .insert(subscribers)
        .values({ email, unsubscribeToken: crypto.randomUUID(), confirmSentAt })
        .onConflictDoUpdate({ target: subscribers.email, set: { confirmSentAt } });
    },
    async confirm(email, confirmSentAt, at) {
      const updated = await db
        .update(subscribers)
        .set({ consentedAt: at, unsubscribedAt: null, confirmSentAt: null })
        .where(and(eq(subscribers.email, email), eq(subscribers.confirmSentAt, confirmSentAt)))
        .returning({ email: subscribers.email });
      return updated.length > 0;
    },
    async unsubscribe(token, at) {
      const updated = await db
        .update(subscribers)
        .set({ unsubscribedAt: at })
        .where(and(eq(subscribers.unsubscribeToken, token), isNull(subscribers.unsubscribedAt)))
        .returning({ email: subscribers.email });
      return updated.length > 0;
    },
  };
}

function list(env: Env) {
  return newsletter({
    store: store(env),
    keys: [env.SUBSCRIBE_LINK_KEY],
    origin: SITE_ORIGIN,
    async send({ email, url, token, expiresIn }) {
      if (!env.SEND_EMAIL || !env.EMAIL_FROM?.trim()) return false;
      const mail = renderEmail(verification, {
        brand: { name: "Germomics", family: "purple" },
        to: email,
        url,
        expiresIn,
        copy: {
          subject: "Confirm your Germomics newsletter subscription",
          heading: "Confirm your subscription",
          intro: `Someone asked for the Germomics newsletter to be sent to ${email}. Confirm to start receiving it.`,
          button: "Confirm subscription",
          ignore:
            "If this was not you, ignore this message. Nothing more is sent to this address unless it is confirmed.",
        },
      });
      const from = { email: env.EMAIL_FROM, name: "Germomics" };
      return (
        await sendEmail(env.SEND_EMAIL, { from, to: email, ...mail }, { secrets: [url, token] })
      ).sent;
    },
  });
}

/** "sent" also answers an address already on the list or mailed in the last few minutes (no mail goes; the page says the same, revealing nothing). */
export async function requestSubscription(
  env: Env,
  email: string,
  now = new Date(),
): Promise<"sent" | "unavailable"> {
  if (!env.SEND_EMAIL || !env.EMAIL_FROM?.trim()) return "unavailable";
  return list(env).request(email, now);
}

/** Read only: the page's GET, since mail scanners open every link. */
export function checkConfirmation(env: Env, token: string | null, now = new Date()) {
  return list(env).check(token, now);
}

export function confirmSubscription(env: Env, token: string | null, now = new Date()) {
  return list(env).confirm(token, now);
}

export function unsubscribe(env: Env, token: string | null, now = new Date()) {
  return list(env).unsubscribe(token, now);
}
