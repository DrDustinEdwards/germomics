// /contact - the canonical contact page (email + mailing address, no form). Prose comes from the
// page:contact content block (D1, editable); {{email}} and {{address_line}} are filled from
// show_config + the contact.address_line setting so the details are never duplicated. ?preview
// shows admin drafts.
import type { Route } from "./+types/contact";
import { getEnv, getSettings } from "~/lib/context.server";
import { getShowConfig } from "~/lib/show.server";
import { loadPage, isPreviewing, setting } from "~/lib/content.server";
import { SITE_ADDRESS_LINE } from "~/lib/site";
import { BodyRenderer } from "~/components/content/BodyRenderer";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: loaderData?.title ?? "Contact" },
    { name: "description", content: "How to reach Germomics by email or post." },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const preview = await isPreviewing(env, request);
  const [page, show] = await Promise.all([
    loadPage(env, "page:contact", { includeDrafts: preview }),
    getShowConfig(env),
  ]);
  const addressLine = setting(getSettings(context), "contact.address_line", SITE_ADDRESS_LINE);
  const html = page.value
    .replaceAll("{{email}}", show.ownerEmail)
    .replaceAll("{{address_line}}", addressLine);
  return { title: page.title || "Contact", html };
}

export default function Contact({ loaderData }: Route.ComponentProps) {
  return (
    <article className="prose-legal mx-auto max-w-2xl">
      <h1 className="font-display text-4xl font-semibold leading-tight">{loaderData.title}</h1>
      <BodyRenderer html={loaderData.html} />
    </article>
  );
}
