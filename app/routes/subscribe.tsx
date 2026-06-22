import { Form, Link } from "react-router";
import { Rss, Check } from "lucide-react";
import type { Route } from "./+types/subscribe";
import { getEnv } from "~/lib/context.server";
import { getDb } from "~/db/index.server";
import { subscribers } from "~/db/schema";
import { getShowConfig } from "~/lib/show.server";

export function meta() {
  return [{ title: "Subscribe — germomics" }];
}

export async function loader({ context }: Route.LoaderArgs) {
  const show = await getShowConfig(getEnv(context));
  return { subscribeLinks: show.subscribeLinks ?? {} };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const consent = form.get("consent");

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false as const, error: "Please enter a valid email address." };
  }
  // Explicit, unambiguous consent is required (GDPR) — no pre-ticked box, no implied opt-in.
  if (consent !== "on") {
    return { ok: false as const, error: "Please tick the consent box so we can email you." };
  }

  // Store email + consent timestamp + an unguessable one-click unsubscribe token. No other PII.
  // Re-subscribing (same email) refreshes consent and clears any prior unsubscribe.
  const db = getDb(getEnv(context));
  const now = new Date().toISOString();
  await db
    .insert(subscribers)
    .values({ email, consentedAt: now, unsubscribeToken: crypto.randomUUID() })
    .onConflictDoUpdate({
      target: subscribers.email,
      set: { consentedAt: now, unsubscribedAt: null },
    });
  return { ok: true as const };
}

export default function Subscribe({ loaderData, actionData }: Route.ComponentProps) {
  const links = Object.entries(loaderData.subscribeLinks);
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-semibold">Subscribe</h1>
      <p className="mt-2 text-muted">
        Follow germomics in your podcast app, or get new episodes and essays by email.
      </p>

      <section className="mt-8">
        <a
          href="/feed/podcast/"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 font-mono text-sm hover:border-accent hover:text-accent"
        >
          <Rss size={15} aria-hidden /> RSS feed
        </a>
        {links.length ? (
          <div className="mt-4 flex flex-wrap gap-3 font-mono text-sm">
            {links.map(([name, url]) => (
              <a
                key={name}
                href={url}
                className="rounded-full border border-border px-4 py-2 hover:border-accent hover:text-accent"
              >
                {name}
              </a>
            ))}
          </div>
        ) : null}
      </section>

      <section className="mt-10 rounded-2xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-semibold">Newsletter</h2>
        {actionData?.ok ? (
          <p role="status" className="mt-3 flex items-center gap-2 text-accent">
            <Check size={16} aria-hidden /> You’re on the list. Thank you.
          </p>
        ) : (
          <Form method="post" className="mt-3 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="flex-1 rounded-lg border border-border bg-card px-3 py-2 outline-none focus-visible:border-accent"
              />
              <button
                type="submit"
                className="rounded-lg bg-brand px-4 py-2 font-display text-sm font-medium text-white hover:bg-brand-strong"
              >
                Subscribe
              </button>
            </div>
            <div className="flex items-start gap-2">
              <input
                id="consent"
                type="checkbox"
                name="consent"
                required
                className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-brand)]"
              />
              <label htmlFor="consent" className="text-sm text-muted">
                I agree to receive the germomics newsletter by email and accept the{" "}
                <Link to="/privacy" className="text-accent hover:underline">
                  privacy policy
                </Link>
                . You can unsubscribe anytime via the link in every email.
              </label>
            </div>
          </Form>
        )}
        {actionData?.ok === false ? (
          <p role="alert" className="mt-2 text-sm text-accent">
            {actionData.error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
