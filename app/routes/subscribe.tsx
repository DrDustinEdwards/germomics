import { useState } from "react";
import { Form } from "react-router";
import { Link } from "capsomer/react/link";
import { Rss, Check, Copy, Mail, Smartphone } from "lucide-react";
import { ExternalCue } from "~/components/ExternalCue";
import { pageHead } from "~/lib/seo";
import type { Route } from "./+types/subscribe";
import { getEnv } from "~/lib/context.server";
import { getDb } from "~/db/index.server";
import { subscribers } from "~/db/schema";
import { getShowConfig } from "~/lib/show.server";
import { SUBSCRIBE_DESTINATIONS, PRIMARY_KEYS, SECONDARY_KEYS } from "~/lib/subscribe";
import { SITE_HOST } from "~/lib/site";

export function meta() {
  return pageHead({ path: "/subscribe", title: "Subscribe · Germomics", description: "Follow Germomics in any podcast app, by email, or by RSS." });
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
  // Explicit, unambiguous consent is required (GDPR). No pre-ticked box, no implied opt-in.
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

const chip =
  "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-sm hover:border-accent hover:text-accent";

export default function Subscribe({ loaderData, actionData }: Route.ComponentProps) {
  const sl = loaderData.subscribeLinks as Record<string, string>;
  const primary = PRIMARY_KEYS.filter((k) => sl[k]);
  const secondary = SECONDARY_KEYS.filter((k) => sl[k]);
  const [copied, setCopied] = useState(false);

  const copyRss = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/feed/podcast/`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-semibold">Subscribe</h1>
      <p className="mt-2 text-muted">
        Follow Germomics in your podcast app, by email, or by RSS. New episodes and essays land
        automatically.
      </p>

      {/* Primary apps */}
      {primary.length ? (
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold">Listen in your app</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {primary.map((k) => {
              const d = SUBSCRIBE_DESTINATIONS[k];
              const Icon = d.icon;
              return (
                <a
                  key={k}
                  href={sl[k]}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 font-display text-sm font-medium hover:border-accent hover:text-accent"
                >
                  <Icon size={18} aria-hidden />
                  <span className="inline-flex items-center gap-1.5">{d.label}<ExternalCue size={14} /></span>
                </a>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Secondary directories */}
      {secondary.length ? (
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold">More directories</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {secondary.map((k) => {
              const d = SUBSCRIBE_DESTINATIONS[k];
              const Icon = d.icon;
              return (
                <a key={k} href={sl[k]} target="_blank" rel="noopener" className={chip}>
                  <Icon size={14} aria-hidden /> {d.label}
                  <ExternalCue />
                </a>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Other ways (feed mechanisms; not identity profiles) */}
      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold">Other ways to subscribe</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={`https://subscribeonandroid.com/${SITE_HOST}/feed/podcast/`} target="_blank" rel="noopener" className={chip}>
            <Smartphone size={14} aria-hidden /> Subscribe on Android
            <ExternalCue />
          </a>
          <a href={`https://subscribebyemail.com/${SITE_HOST}/feed/podcast/`} target="_blank" rel="noopener" className={chip}>
            <Mail size={14} aria-hidden /> Subscribe by Email
            <ExternalCue />
          </a>
          <a href="/feed/podcast/" target="_blank" rel="noopener" className={chip}>
            <Rss size={14} aria-hidden /> RSS feed
            <ExternalCue />
          </a>
          <button type="button" onClick={copyRss} className={chip}>
            {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
            {copied ? "Copied" : "Copy RSS link"}
          </button>
        </div>
      </section>

      {/* Newsletter */}
      <section className="mt-10 rounded-2xl border border-border bg-surface p-6">
        <h2 className="font-display text-lg font-semibold">Newsletter</h2>
        {actionData?.ok ? (
          <p role="status" className="mt-3 flex items-center gap-2 text-accent">
            <Check size={16} aria-hidden /> You’re on the list. Thank you.
          </p>
        ) : (
          <Form method="post" className="mt-3 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="email" className="sr-only">Email address</label>
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
              <input id="consent" type="checkbox" name="consent" required className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-brand)]" />
              <label htmlFor="consent" className="text-sm text-muted">
                I agree to receive the Germomics newsletter by email and accept the{" "}
                <Link to="/privacy" className="text-accent hover:underline">privacy policy</Link>. You
                can unsubscribe anytime via the link in every email.
              </label>
            </div>
          </Form>
        )}
        {actionData?.ok === false ? (
          <p role="alert" className="mt-2 text-sm text-accent">{actionData.error}</p>
        ) : null}
      </section>
    </div>
  );
}
