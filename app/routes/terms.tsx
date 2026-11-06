// /terms - terms of use. Prose comes from the page:terms content block (D1, editable), with
// {{email}} filled from show_config. DRAFT banner stays as chrome. ?preview shows admin drafts.
import { pageHead } from "~/lib/seo";
import type { Route } from "./+types/terms";
import { getEnv } from "~/lib/context.server";
import { loadFilledPage } from "~/lib/content.server";
import { LegalPage } from "~/components/content/Legal";

export function meta({ loaderData }: Route.MetaArgs) {
  return pageHead({ path: "/terms", title: loaderData?.title ?? "Terms of use", description: "The Germomics terms of use: the rules for using germomics.com, its podcast episodes, writing, data pages and games." });
}

export async function loader({ request, context }: Route.LoaderArgs) {
  return loadFilledPage(getEnv(context), request, "page:terms", "Terms of use");
}

export default function Terms({ loaderData }: Route.ComponentProps) {
  return <LegalPage {...loaderData} />;
}
