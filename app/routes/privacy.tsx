// /privacy - privacy policy. Prose comes from the page:privacy content block (D1, editable), with
// {{email}} and {{address_line}} filled from show_config + the contact.address_line setting so the
// contact details are never duplicated. DRAFT banner stays as chrome. ?preview shows admin drafts.
import type { Route } from "./+types/privacy";
import { getEnv, getSettings } from "~/lib/context.server";
import { loadFilledPage, setting } from "~/lib/content.server";
import { SITE_ADDRESS_LINE } from "~/lib/site";
import { LegalPage } from "~/components/content/Legal";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: loaderData?.title ?? "Privacy policy" },
    { name: "description", content: "How Germomics handles your data." },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const addressLine = setting(getSettings(context), "contact.address_line", SITE_ADDRESS_LINE);
  return loadFilledPage(getEnv(context), request, "page:privacy", "Privacy policy", addressLine);
}

export default function Privacy({ loaderData }: Route.ComponentProps) {
  return <LegalPage {...loaderData} />;
}
