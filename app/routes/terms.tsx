// /terms - terms of use. Prose comes from the page:terms content block (D1, editable), with
// {{email}} filled from show_config. DRAFT banner stays as chrome. ?preview shows admin drafts.
import type { Route } from "./+types/terms";
import { getEnv } from "~/lib/context.server";
import { getShowConfig } from "~/lib/show.server";
import { loadPage, isPreviewing } from "~/lib/content.server";
import { BodyRenderer } from "~/components/content/BodyRenderer";
import { ReviewBanner, LegalDate } from "~/components/content/Legal";

export function meta({ loaderData }: Route.MetaArgs) {
  return [
    { title: loaderData?.title ?? "Terms of use" },
    { name: "description", content: "The terms for using germomics." },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const preview = await isPreviewing(env, request);
  const [page, show] = await Promise.all([
    loadPage(env, "page:terms", { includeDrafts: preview }),
    getShowConfig(env),
  ]);
  const html = page.value.replaceAll("{{email}}", show.ownerEmail);
  return { title: page.title || "Terms of use", html };
}

export default function Terms({ loaderData }: Route.ComponentProps) {
  return (
    <article className="prose-legal mx-auto max-w-2xl">
      <h1 className="font-display text-4xl font-semibold leading-tight">{loaderData.title}</h1>
      <LegalDate />
      <ReviewBanner />
      <BodyRenderer html={loaderData.html} />
    </article>
  );
}
