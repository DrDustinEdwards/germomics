import { isEmail } from "@dustinedwards/site-runtime/email";
import { Form } from "react-router";
import { Link } from "capsomer/react/link";
import { Rss, Check, Copy, Mail, Smartphone } from "lucide-react";
import { CopyButton } from "~/components/content/CopyLink";
import { ExternalCue } from "~/components/ExternalCue";
import { pageHead } from "~/lib/seo";
import type { Route } from "./+types/subscribe";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { requestSubscription } from "~/lib/newsletter.server";
import { getShowConfig } from "~/lib/show.server";
import { SUBSCRIBE_DESTINATIONS, PRIMARY_KEYS, SECONDARY_KEYS } from "~/lib/subscribe";
import { SITE_HOST } from "~/lib/site";
import { readForm } from "@dustinedwards/site-runtime/body";
import { PUBLIC_FORM } from "~/lib/body.server";

export function meta() {
  return pageHead({
    path: "/subscribe",
    title: "Subscribe · Germomics",
    description:
      "Follow Germomics, the podcast about microbiology and history, in any podcast app, by email, or with its RSS feed.",
  });
}

export async function loader({ context }: Route.LoaderArgs) {
  const show = await getShowConfig(getEnv(context));
  return { subscribeLinks: show.subscribeLinks ?? {} };
}

export async function action({ request, context }: Route.ActionArgs) {
  const form = await readForm(request, PUBLIC_FORM);
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const consent = form.get("consent");

  if (!isEmail(email)) {
    return { ok: false as const, error: "Please enter a valid email address." };
  }
  // Explicit, unambiguous consent is required (GDPR). No pre-ticked box, no implied opt-in.
  if (consent !== "on") {
    return { ok: false as const, error: "Please tick the consent box so we can email you." };
  }

  // Double opt-in: this only mails the address a confirmation link. Nothing is subscribed, and no earlier unsubscribe
  // is undone, until the address's owner opens it (app/lib/newsletter.server.ts).
  if ((await requestSubscription(getEnv(context), email)) === "unavailable") {
    return {
      ok: false as const,
      error:
        "Email signup is not available right now. Please try again later, or follow the RSS feed.",
    };
  }
  return { ok: true as const };
}

export default function Subscribe({ loaderData, actionData }: Route.ComponentProps) {
  const sl = loaderData.subscribeLinks as Record<string, string>;
  const primary = PRIMARY_KEYS.filter((k) => sl[k]);
  const secondary = SECONDARY_KEYS.filter((k) => sl[k]);

  return (
    <div className="gm-narrow">
      <h1 className="gm-page-title">Subscribe</h1>
      <p className="gm-lede">
        Follow Germomics in your podcast app, by email, or by RSS. New episodes and essays land
        automatically.
      </p>

      {/* Primary apps */}
      {primary.length ? (
        <section className="gm-sub-section">
          <h2 className="gm-sub-title">Listen in your app</h2>
          <div className="gm-sub-apps">
            {primary.map((k) => {
              const d = SUBSCRIBE_DESTINATIONS[k];
              const Icon = d.icon;
              return (
                <a key={k} href={sl[k]} className="gm-sub-app">
                  <Icon size={18} aria-hidden />
                  <span className="gm-sub-app-name">
                    {d.label}
                    <ExternalCue size={14} />
                  </span>
                </a>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Secondary directories */}
      {secondary.length ? (
        <section className="gm-sub-section">
          <h2 className="gm-sub-title">More directories</h2>
          <div className="gm-sub-chips">
            {secondary.map((k) => {
              const d = SUBSCRIBE_DESTINATIONS[k];
              const Icon = d.icon;
              return (
                <a key={k} href={sl[k]} className="gm-chip">
                  <Icon size={14} aria-hidden /> {d.label}
                  <ExternalCue />
                </a>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Other ways (feed mechanisms; not identity profiles) */}
      <section className="gm-sub-section">
        <h2 className="gm-sub-title">Other ways to subscribe</h2>
        <div className="gm-sub-chips">
          <a href={`https://subscribeonandroid.com/${SITE_HOST}/feed/podcast/`} className="gm-chip">
            <Smartphone size={14} aria-hidden /> Subscribe on Android
            <ExternalCue />
          </a>
          <a href={`https://subscribebyemail.com/${SITE_HOST}/feed/podcast/`} className="gm-chip">
            <Mail size={14} aria-hidden /> Subscribe by Email
            <ExternalCue />
          </a>
          <a href="/feed/podcast/" className="gm-chip">
            <Rss size={14} aria-hidden /> RSS feed
          </a>
          <CopyButton path="/feed/podcast/" label="Copy RSS link" icon={Copy} className="gm-chip" />
        </div>
      </section>

      {/* Newsletter */}
      <section className="gm-callout">
        <h2 className="gm-sub-title">Newsletter</h2>
        {actionData?.ok ? (
          <p role="status" className="gm-sub-done">
            <Check size={16} aria-hidden /> Almost done: check your inbox for a link to confirm your
            subscription.
          </p>
        ) : (
          <Form method="post" className="gm-sub-form">
            <div className="gm-sub-row">
              <label htmlFor="email" className="cap-sr-only">
                Email address
              </label>
              <input
                id="email"
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="gm-sub-input"
              />
              <button type="submit" className="gm-sub-button">
                Subscribe
              </button>
            </div>
            <div className="gm-sub-consent">
              <input
                id="consent"
                type="checkbox"
                name="consent"
                required
                className="gm-sub-check"
              />
              <label htmlFor="consent" className="gm-sub-consent-text">
                I agree to receive the Germomics newsletter by email and accept the{" "}
                <Link to="/privacy" className="gm-sub-consent-link">
                  privacy policy
                </Link>
                . You can unsubscribe anytime via the link in every email.
              </label>
            </div>
          </Form>
        )}
        {actionData?.ok === false ? (
          <p role="alert" className="gm-form-note">
            {actionData.error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
