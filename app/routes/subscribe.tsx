import { isEmail } from "@dustinedwards/site-runtime/email";
import { Form } from "react-router";
import { Link } from "capsomer/react/link";
import { NewsletterSignup } from "capsomer/react/newsletter-signup";
// The sign-up builds on field.css and button.css, which the public layout already loads (site.css).
import "capsomer/newsletter-signup.css";
import { CopyButton } from "~/components/content/CopyLink";
import { ExternalCue } from "~/components/ExternalCue";
import { pageHead } from "~/lib/seo";
import type { Route } from "./+types/subscribe";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { requestSubscription } from "~/lib/newsletter.server";
import { getShowConfig } from "~/lib/show.server";
import { SUBSCRIBE_DESTINATIONS, PRIMARY_KEYS, SECONDARY_KEYS } from "~/lib/subscribe";
import { SITE_HOST } from "~/lib/site";
import { Icon, iconCopy, iconMail, iconPhone, iconRss } from "capsomer/react/icons";
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
              return (
                <a key={k} href={sl[k]} className="gm-sub-app">
                  <Icon d={d.icon} />
                  <span className="gm-sub-app-name">
                    {d.label}
                    <ExternalCue />
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
              return (
                <a key={k} href={sl[k]} className="gm-chip">
                  <Icon d={d.icon} /> {d.label}
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
            <Icon d={iconPhone} /> Subscribe on Android
            <ExternalCue />
          </a>
          <a href={`https://subscribebyemail.com/${SITE_HOST}/feed/podcast/`} className="gm-chip">
            <Icon d={iconMail} /> Subscribe by Email
            <ExternalCue />
          </a>
          <a href="/feed/podcast/" className="gm-chip">
            <Icon d={iconRss} /> RSS feed
          </a>
          <CopyButton
            path="/feed/podcast/"
            label="Copy RSS link"
            icon={iconCopy}
            className="gm-chip"
          />
        </div>
      </section>

      {/* Newsletter: Capsomer's sign-up; the action above sends the confirmation link (double opt-in). */}
      <NewsletterSignup
        state={actionData}
        consent={
          <>
            I agree to receive the Germomics newsletter by email and accept the{" "}
            <Link to="/privacy">privacy policy</Link>. You can unsubscribe anytime via the link in
            every email.
          </>
        }
        renderForm={({ children, ...props }) => <Form {...props}>{children}</Form>}
      />
    </div>
  );
}
