// /terms — terms of use. Drafted for a single-author podcast/writing site with a newsletter and
// game leaderboards. DRAFT: clearly marked as needing Dustin's review; not legal advice.
import type { Route } from "./+types/terms";
import { getEnv } from "~/lib/context.server";
import { getShowConfig } from "~/lib/show.server";
import { ReviewBanner, LegalDate } from "~/components/content/Legal";

export function meta() {
  return [
    { title: "Terms of use — germomics" },
    { name: "description", content: "The terms for using germomics." },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const show = await getShowConfig(getEnv(context));
  return { email: show.ownerEmail, title: show.title };
}

export default function Terms({ loaderData }: Route.ComponentProps) {
  const { email } = loaderData;
  return (
    <article className="prose-legal mx-auto max-w-2xl">
      <h1 className="font-display text-4xl font-semibold leading-tight">Terms of use</h1>
      <LegalDate />
      <ReviewBanner />

      <p>
        These terms govern your use of the germomics website, podcast, writing, data pages, and
        games (the “site”). By using the site you agree to them. If you don’t agree, please don’t use
        the site.
      </p>

      <h2>Content &amp; intellectual property</h2>
      <p>
        Episodes, transcripts, writing, artwork, and other original material are © germomics and its
        author unless otherwise noted, and are provided for personal, non-commercial use. The podcast
        RSS feed may be used by podcast apps and directories in the normal way. You may quote and
        link to the site with attribution. AI/citation use is described in our{" "}
        <a href="/ai.txt">ai.txt</a> and <a href="/robots.txt">robots.txt</a>.
      </p>

      <h2>Your submissions</h2>
      <p>
        If you join the newsletter, you confirm the email address is yours and you consent to receive
        it; you can unsubscribe at any time. If you submit a game score or similar, don’t include
        personal information or offensive content in any name field — we may remove submissions that
        do.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Don’t attempt to disrupt, overload, probe, or gain unauthorized access to the site, and don’t
        scrape it in ways that harm its operation. We use rate limiting and other protections.
      </p>

      <h2>Third-party links &amp; services</h2>
      <p>
        The site links to and relies on third parties (podcast apps, Cloudflare, OP3, Google for
        admin sign-in). We aren’t responsible for third-party content or practices; see our{" "}
        <a href="/privacy">privacy policy</a>.
      </p>

      <h2>Disclaimer</h2>
      <p>
        The site is provided “as is,” without warranties of any kind. Content about microbiology and
        history is for general information and is not medical, scientific, or professional advice.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, germomics and its author are not liable for any
        indirect or consequential damages arising from your use of the site.
      </p>

      <h2>Changes</h2>
      <p>We may update these terms; continued use after an update means you accept the new terms.</p>

      <h2>Governing law</h2>
      <p>
        These terms are governed by the laws of the site owner’s jurisdiction.{" "}
        <em>[Placeholder — Dustin to specify jurisdiction.]</em>
      </p>

      <h2>Contact</h2>
      <p>
        Questions: <a href={`mailto:${email}`}>{email}</a>.
      </p>
    </article>
  );
}
