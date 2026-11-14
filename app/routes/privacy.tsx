// /privacy - privacy policy. Prose comes from the page:privacy content block (D1, editable), with
// {{email}} and {{address_line}} filled from show_config + the contact.address_line setting so the
// contact details are never duplicated. DRAFT banner stays as chrome. ?preview shows admin drafts.
import { pageHead } from "~/lib/seo";
import type { Route } from "./+types/privacy";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { getSettings } from "~/lib/context.server";
import { loadFilledPage } from "~/lib/content.server";
import { LegalPage } from "~/components/content/Legal";

export function meta({ loaderData }: Route.MetaArgs) {
  return pageHead({
    path: "/privacy",
    title: loaderData?.title ?? "Privacy policy",
    description:
      "The Germomics privacy policy: what data germomics.com collects when you listen, read or subscribe, and how it is used.",
  });
}

export async function loader({ request, context }: Route.LoaderArgs) {
  return loadFilledPage(
    getEnv(context),
    request,
    "page:privacy",
    "Privacy policy",
    getSettings(context),
  );
}

export default function Privacy({ loaderData }: Route.ComponentProps) {
  return <LegalPage {...loaderData} />;
}
