// /privacy - privacy policy. Prose comes from the page:privacy content block (D1, editable), with
// {{email}} and {{address_line}} filled from show_config + the contact.address_line setting so the
// contact details are never duplicated. DRAFT banner stays as chrome. ?preview shows admin drafts.
import type { Route } from "./+types/privacy";
import { getEnv, getSettings } from "~/lib/context.server";
import { getShowConfig } from "~/lib/show.server";
import { loadPage, isPreviewing, setting } from "~/lib/content.server";
import { SITE_ADDRESS_LINE } from "~/lib/site";
import { BodyRenderer } from "~/components/content/BodyRenderer";
import { ReviewBanner, LegalDate } from "~/components/content/Legal";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: loaderData?.title ?? "Privacy policy" },
    { name: "description", content: "How germomics handles your data." },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const preview = await isPreviewing(env, request);
  const [page, show] = await Promise.all([
    loadPage(env, "page:privacy", { includeDrafts: preview }),
    getShowConfig(env),
  ]);
  const addressLine = setting(getSettings(context), "contact.address_line", SITE_ADDRESS_LINE);
  const html = page.value
    .replaceAll("{{email}}", show.ownerEmail)
    .replaceAll("{{address_line}}", addressLine);
  return { title: page.title || "Privacy policy", html };
}

export default function Privacy({ loaderData }: Route.ComponentProps) {
  return (
    <article className="prose-legal mx-auto max-w-2xl">
      <h1 className="font-display text-4xl font-semibold leading-tight">{loaderData.title}</h1>
      <LegalDate />
      <ReviewBanner />
      <BodyRenderer html={loaderData.html} />
    </article>
  );
}
