// Admin → edit one content block (page or snippet). Behind the admin gate (admin.tsx middleware).
// Pages have a draft/publish status and a Preview link (renders the draft in real context via
// ?preview); snippets are instant. A Markdown page's text is written in Carrel, so here it is shown as the
// site renders it, with a link to edit it there, and only its title and status are saved; the plain-text pages
// (TEXT_PAGES) and the snippets are edited here.
import { useFetcher } from "react-router";
import { Icon } from "capsomer/react/icons";
import type { Route } from "./+types/admin.content.$key";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { loadBlock, TEXT_PAGES, updatePageSettings, upsertBlock } from "~/lib/content.server";
import { BodyRenderer } from "~/components/content/BodyRenderer";
import { carrelEditUrl } from "~/lib/site";
import { Panel } from "capsomer/react/panel";
import { Field } from "capsomer/react/field";
import { Button } from "capsomer/react/button";
import { PAGE_HREF } from "~/components/content/PageHits";
import { readForm } from "@dustinedwards/site-runtime/body";
import { ADMIN_FORM } from "~/lib/body.server";

export async function loader({ params, context }: Route.LoaderArgs) {
  const block = await loadBlock(getEnv(context), params.key, { includeDrafts: true });
  if (!block) throw new Response("Not found", { status: 404 });
  // loadBlock omits kind/description; fetch them is unnecessary here, infer kind from the key.
  const kind = params.key.startsWith("page:") ? "page" : "snippet";
  const markdown = kind === "page" && !TEXT_PAGES.has(params.key);
  return {
    block,
    kind,
    markdown,
    previewHref: PAGE_HREF[params.key] ?? null,
    carrelUrl: markdown ? carrelEditUrl(params.key.replace(/^page:/, "page.")) : null,
  };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const form = await readForm(request, ADMIN_FORM);
  const kind = params.key.startsWith("page:") ? "page" : "snippet";
  const title = String(form.get("title") ?? "") || null;
  const status = form.get("status") === "published" ? "published" : "draft";
  if (kind === "page" && !TEXT_PAGES.has(params.key)) {
    await updatePageSettings(getEnv(context), params.key, { title, status });
    return { ok: true as const, message: "Saved." };
  }
  // The plain-text pages are served as text and keep their bytes; a snippet is text in the page's markup.
  const value = String(form.get("value") ?? "");
  await upsertBlock(getEnv(context), {
    key: params.key,
    kind,
    title,
    value,
    status: kind === "page" ? status : "published",
  });
  return { ok: true as const, message: "Saved." };
}

export default function EditBlock({ loaderData }: Route.ComponentProps) {
  const { block, kind, markdown, previewHref, carrelUrl } = loaderData;
  const fetcher = useFetcher<{ ok: boolean; message?: string }>();
  const isPage = kind === "page";

  return (
    <div className="mx-auto max-w-3xl">
      <a
        href="/admin/settings"
        className="inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-ink"
      >
        <Icon name="arrow-left" className="size-3" /> Settings
      </a>
      <h1 className="mt-3 font-display text-2xl font-semibold">{block.title || block.key}</h1>
      <p className="mt-1 font-mono text-xs text-muted">
        {block.key} ({kind}
        {isPage ? `, ${block.status}` : ", instant"})
      </p>

      <fetcher.Form method="post" className="mt-6 space-y-5">
        <Panel title="Content">
          <div className="space-y-4">
            <Field label="Title">
              {(control) => (
                <input {...control} name="title" defaultValue={block.title} className="cap-input" />
              )}
            </Field>
            {markdown && carrelUrl ? (
              <div className="space-y-2">
                <p className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
                  <span>
                    Written in Carrel. {"{{email}}"} and {"{{address_line}}"} are filled in on the
                    legal and contact pages.
                  </span>
                  <a
                    href={carrelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs text-accent hover:underline"
                  >
                    <Icon name="external" className="size-[13px]" /> Edit in Carrel
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </p>
                <div className="max-h-[32rem] overflow-y-auto rounded-xl border border-border bg-card p-4">
                  <BodyRenderer html={block.html} />
                </div>
              </div>
            ) : (
              <Field
                label={isPage ? "Body (plain text)" : "Value"}
                help={isPage ? "Served as plain text, as written." : undefined}
              >
                {(control) => (
                  <textarea
                    {...control}
                    name="value"
                    defaultValue={block.value}
                    rows={isPage ? 18 : 4}
                    className="cap-input font-mono text-xs"
                  />
                )}
              </Field>
            )}
            {isPage ? (
              <Field
                label="Status"
                help="Only published pages render publicly. Drafts are visible via Preview."
              >
                {(control) => (
                  <select
                    {...control}
                    name="status"
                    defaultValue={block.status}
                    className="cap-input"
                  >
                    <option value="draft">draft</option>
                    <option value="published">published</option>
                  </select>
                )}
              </Field>
            ) : null}
          </div>
        </Panel>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" pending={fetcher.state !== "idle"}>
            Save
          </Button>
          {isPage && previewHref ? (
            <a
              href={`${previewHref}?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-sm text-accent hover:underline"
            >
              <Icon name="external" className="size-[13px]" /> Preview
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}
          {fetcher.data?.ok ? (
            <span role="status" className="font-mono text-xs text-accent">
              {fetcher.data.message}
            </span>
          ) : null}
        </div>
      </fetcher.Form>
    </div>
  );
}
