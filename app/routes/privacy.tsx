// /privacy — privacy policy. Drafted for a single-author podcast/writing site with an email
// newsletter, cookieless analytics, OP3 download analytics, and admin-only Google sign-in.
// DRAFT: clearly marked as needing Dustin's review; not legal advice.
import type { Route } from "./+types/privacy";
import { getEnv } from "~/lib/context.server";
import { getShowConfig } from "~/lib/show.server";
import { ReviewBanner, LegalDate } from "~/components/content/Legal";
import { SITE_ADDRESS_LINE } from "~/lib/site";

export function meta() {
  return [
    { title: "Privacy policy — germomics" },
    { name: "description", content: "How germomics handles your data." },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const show = await getShowConfig(getEnv(context));
  return { email: show.ownerEmail };
}

export default function Privacy({ loaderData }: Route.ComponentProps) {
  const { email } = loaderData;
  return (
    <article className="prose-legal mx-auto max-w-2xl">
      <h1 className="font-display text-4xl font-semibold leading-tight">Privacy policy</h1>
      <LegalDate />
      <ReviewBanner />

      <p>
        germomics is an independent podcast and writing project run by a single author. This policy
        explains what personal data the site collects, why, and your choices. We collect as little
        as possible.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Newsletter email.</strong> If you subscribe, we store your email address, the time
          you gave consent, and an unsubscribe token. Nothing else.
        </li>
        <li>
          <strong>Web analytics (cookieless).</strong> We use Cloudflare Web Analytics, which
          measures aggregate traffic without cookies and without tracking you across sites.
        </li>
        <li>
          <strong>Podcast download analytics.</strong> Episode audio is served through OP3, an open,
          privacy-respecting analytics prefix that counts downloads. It processes request data such
          as IP address and app/user-agent to produce aggregate stats; it is not used to identify
          you.
        </li>
        <li>
          <strong>On-device storage.</strong> Your theme choice and audio playback position are kept
          in your browser’s local storage and never sent to us.
        </li>
        <li>
          <strong>Admin sign-in.</strong> The site’s single administrator signs in with Google
          (OAuth). This is not available to visitors and processes only the administrator’s account.
        </li>
        <li>
          <strong>Server &amp; security logs.</strong> Our host (Cloudflare) processes standard
          request data to deliver and protect the site.
        </li>
      </ul>

      <h2>How we use it</h2>
      <p>
        To send the newsletter you asked for, understand aggregate audience and download numbers,
        keep the site secure and working, and operate the admin tools. We do not sell your data or
        use it for cross-site advertising.
      </p>

      <h2>Legal bases (GDPR)</h2>
      <p>
        Newsletter email is processed on the basis of your <strong>consent</strong>. Security and
        aggregate analytics rely on our <strong>legitimate interests</strong> in running a safe,
        functional site.
      </p>

      <h2>Who we share it with</h2>
      <p>
        Service providers that make the site work: <strong>Cloudflare</strong> (hosting, storage,
        cookieless analytics), <strong>OP3</strong> (download analytics), and <strong>Google</strong>{" "}
        (administrator sign-in only). Each processes data on our behalf under their own terms.
      </p>

      <h2>Your choices &amp; rights</h2>
      <ul>
        <li>
          <strong>Unsubscribe</strong> anytime via the one-click link in every newsletter email.
        </li>
        <li>
          You may request access to, correction of, or deletion of your data, where applicable under
          GDPR/CCPA, by emailing us.
        </li>
      </ul>

      <h2>Retention</h2>
      <p>
        We keep your newsletter email until you unsubscribe (after which it is suppressed so we don’t
        accidentally re-add you). Aggregate analytics are retained by our providers per their
        policies.
      </p>

      <h2>Children</h2>
      <p>The site is not directed to children under 13, and we do not knowingly collect their data.</p>

      <h2>Changes</h2>
      <p>We’ll update this page if our practices change, and revise the date above.</p>

      <h2>Contact</h2>
      <p>
        Questions or requests: <a href={`mailto:${email}`}>{email}</a>.
      </p>
      <address className="not-italic">By post: {SITE_ADDRESS_LINE}.</address>
    </article>
  );
}
