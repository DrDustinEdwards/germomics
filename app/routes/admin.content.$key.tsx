// Admin → one content block (page or snippet). Behind the admin gate (admin.tsx middleware).
// A Markdown page is writing, which Carrel alone edits: shown here as rendered, and refused by the action. The
// plain-text pages (TEXT_PAGES, draft or published, with ?preview) and the snippets (instant) are edited here.
import { useFetcher } from "react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Route } from "./+types/admin.content.$key";
import { getEnv } from "~/lib/context.server";
import { loadBlock, TEXT_PAGES, upsertBlock } from "~/lib/content.server";
import { BodyRenderer } from "~/components/content/BodyRenderer";
import { carrelEditUrl } from "~/lib/site";
import { Card, Field, Button, inputCx } from "~/components/admin/ui";
import { PAGE_HREF } from "~/components/content/PageHits";
import { ADMIN_FORM, readForm } from "~/lib/body.server";

export async function loader({ params, context }: Route.LoaderArgs) {
  const block = await loadBlock(getEnv(context), params.key, { includeDrafts: true });
  if (!block) throw new Response("Not found", { status: 404 });
  // loadBlock omits kind/description; fetch them is unnecessary here, infer kind from the key.
  const kind = params.key.startsWith("page:") ? "page" : "snippet";
  const markdown = kind === "page" && !TEXT_PAGES.has(params.key);
  return { block, kind, markdown, previewHref: PAGE_HREF[params.key] ?? null, carrelUrl: markdown ? carrelEditUrl(params.key.replace(/^page:/, "page.")) : null };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const kind = params.key.startsWith("page:") ? "page" : "snippet";
  if (kind === "page" && !TEXT_PAGES.has(params.key)) throw new Response("This page is edited in Carrel.", { status: 405 });
  const form = await readForm(request, ADMIN_FORM);
  const title = String(form.get("title") ?? "") || null;
  const status = form.get("status") === "published" ? "published" : "draft";
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
      <a href="/admin/settings" className="inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-ink">
        <ArrowLeft size={12} aria-hidden /> Settings
      </a>
      <h1 className="mt-3 font-display text-2xl font-semibold">{block.title || block.key}</h1>
      <p className="mt-1 font-mono text-xs text-muted">
        {block.key} ({kind}
        {isPage ? `, ${block.status}` : ", instant"})
      </p>

      {markdown && carrelUrl ? (
        <div className="mt-6">
          <Card title="Content">
            <div className="space-y-2">
              <p className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
                <span>Written in Carrel, its title and status too. {"{{email}}"} and {"{{address_line}}"} are filled in on the legal and contact pages.</span>
                <a href={carrelUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-accent hover:underline">
                  <ExternalLink size={13} aria-hidden /> Edit in Carrel
                </a>
              </p>
              <div className="max-h-[32rem] overflow-y-auto rounded-xl border border-border bg-card p-4">
                <BodyRenderer html={block.html} />
              </div>
            </div>
          </Card>
        </div>
      ) : (
        <fetcher.Form method="post" className="mt-6 space-y-5">
          <Card title="Content">
            <div className="space-y-4">
              <Field label="Title">
                {({ id }) => <input id={id} name="title" defaultValue={block.title} className={inputCx} />}
              </Field>
              <Field label={isPage ? "Body (plain text)" : "Value"} hint={isPage ? "Served as plain text, as written." : undefined}>
                {({ id }) => (
                  <textarea id={id} name="value" defaultValue={block.value} rows={isPage ? 18 : 4} className={`${inputCx} font-mono text-xs`} />
                )}
              </Field>
              {isPage ? (
                <Field label="Status" hint="Only published pages render publicly. Drafts are visible via Preview.">
                  {({ id }) => (
                    <select id={id} name="status" defaultValue={block.status} className={inputCx}>
                      <option value="draft">draft</option>
                      <option value="published">published</option>
                    </select>
                  )}
                </Field>
              ) : null}
            </div>
          </Card>

          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" disabled={fetcher.state !== "idle"}>Save</Button>
            {isPage && previewHref ? (
              <a href={`${previewHref}?preview=1`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-sm text-accent hover:underline">
                <ExternalLink size={13} aria-hidden /> Preview
              </a>
            ) : null}
            {fetcher.data?.ok ? (
              <span role="status" className="font-mono text-xs text-accent">{fetcher.data.message}</span>
            ) : null}
          </div>
        </fetcher.Form>
      )}
    </div>
  );
}
