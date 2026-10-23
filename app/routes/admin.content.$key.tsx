// Admin → edit one content block (page or snippet). Behind the admin gate (admin.tsx middleware).
// Pages have a draft/publish status and a Preview link (renders the draft in real context via
// ?preview); snippets are instant. Saving busts the content cache.
import { useFetcher } from "react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Route } from "./+types/admin.content.$key";
import { getEnv } from "~/lib/context.server";
import { loadBlock, TEXT_PAGES, upsertBlock } from "~/lib/content.server";
import { sanitizeHtml } from "~/lib/sanitize.server";
import { Card, Field, Button, inputCx } from "~/components/admin/ui";
import { PAGE_HREF } from "~/components/content/PageHits";

export async function loader({ params, context }: Route.LoaderArgs) {
  const block = await loadBlock(getEnv(context), params.key, { includeDrafts: true });
  if (!block) throw new Response("Not found", { status: 404 });
  // loadBlock omits kind/description; fetch them is unnecessary here, infer kind from the key.
  const kind = params.key.startsWith("page:") ? "page" : "snippet";
  return { block, kind, previewHref: PAGE_HREF[params.key] ?? null };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const kind = params.key.startsWith("page:") ? "page" : "snippet";
  const raw = String(form.get("value") ?? "");
  // A page body is injected as HTML, so it goes through the same sanitizer as a post body
  // (Grok audit 2026-10-21, GE-3). The plain-text pages are served as text and keep their bytes.
  const value = kind === "page" && !TEXT_PAGES.has(params.key) ? await sanitizeHtml(raw) : raw;
  await upsertBlock(getEnv(context), {
    key: params.key,
    kind,
    title: String(form.get("title") ?? "") || null,
    value,
    status: kind === "page" ? (form.get("status") === "published" ? "published" : "draft") : "published",
  });
  return { ok: true as const, message: "Saved." };
}

export default function EditBlock({ loaderData }: Route.ComponentProps) {
  const { block, kind, previewHref } = loaderData;
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

      <fetcher.Form method="post" className="mt-6 space-y-5">
        <Card title="Content">
          <div className="space-y-4">
            <Field label="Title">
              {({ id }) => <input id={id} name="title" defaultValue={block.title} className={inputCx} />}
            </Field>
            <Field label={isPage ? "Body (HTML)" : "Value"} hint={isPage ? "Rendered as sanitized HTML. {{email}} and {{address_line}} are filled in on legal pages." : undefined}>
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
    </div>
  );
}
