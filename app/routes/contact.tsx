// /contact - the canonical contact page (email + mailing address, no form). Prose comes from the
// page:contact content block (D1, editable); {{email}} and {{address_line}} are filled from
// show_config + the contact.address_line setting so the details are never duplicated. ?preview
// shows admin drafts.
import { pageHead } from "~/lib/seo";
import type { Route } from "./+types/contact";
import { getEnv, getSettings } from "~/lib/context.server";
import { loadFilledPage, setting } from "~/lib/content.server";
import { SITE_ADDRESS_LINE } from "~/lib/site";
import { BodyRenderer } from "~/components/content/BodyRenderer";

export function meta({ loaderData }: Route.MetaArgs) {
  return pageHead({ path: "/contact", title: loaderData?.title ?? "Contact", description: "How to reach Germomics by email or by post, with a question about an episode or anything else about the show." });
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const addressLine = getSettings(context).then((s) => setting(s, "contact.address_line", SITE_ADDRESS_LINE));
  return loadFilledPage(getEnv(context), request, "page:contact", "Contact", addressLine);
}

export default function Contact({ loaderData }: Route.ComponentProps) {
  return (
    <article className="prose-legal mx-auto max-w-2xl">
      <h1 className="font-display text-4xl font-semibold leading-tight">{loaderData.title}</h1>
      <BodyRenderer html={loaderData.html} page />
    </article>
  );
}
