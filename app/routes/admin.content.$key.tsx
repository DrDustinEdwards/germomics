// Admin → one content page. Behind the admin gate (admin.tsx middleware).
// A Markdown page is writing, which Carrel alone edits (its title and status too): shown here as rendered, and refused
// by the action. The plain-text pages (TEXT_PAGES, draft or published, with a Preview link via ?preview) are edited here.
import { useFetcher } from "react-router";
import { Icon, iconArrowLeft, iconExternal } from "capsomer/react/icons";
import type { Route } from "./+types/admin.content.$key";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { loadBlock, TEXT_PAGES, upsertBlock } from "~/lib/content.server";
import { BodyRenderer } from "~/components/content/BodyRenderer";
import { carrelEditUrl, PAGE_HREF } from "~/lib/site";
import { Panel } from "capsomer/react/panel";
import { Field } from "capsomer/react/field";
import { Button } from "capsomer/react/button";
import { readForm } from "@dustinedwards/site-runtime/body";
import { ADMIN_FORM } from "~/lib/body.server";

export async function loader({ params, context }: Route.LoaderArgs) {
  const block = await loadBlock(getEnv(context), params.key, { includeDrafts: true });
  if (!block) throw new Response("Not found", { status: 404 });
  const markdown = !TEXT_PAGES.has(params.key);
  return {
    block,
    markdown,
    previewHref: PAGE_HREF[params.key] ?? null,
    carrelUrl: markdown ? carrelEditUrl(params.key.replace(/^page:/, "page.")) : null,
  };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  if (!TEXT_PAGES.has(params.key))
    throw new Response("This page is edited in Carrel.", { status: 405 });
  const form = await readForm(request, ADMIN_FORM);
  const title = String(form.get("title") ?? "") || null;
  const status = form.get("status") === "published" ? "published" : "draft";
  // The plain-text pages are served as text and keep their bytes.
  const value = String(form.get("value") ?? "");
  await upsertBlock(getEnv(context), {
    key: params.key,
    title,
    value,
    status,
  });
  return { ok: true as const, message: "Saved." };
}

export default function EditBlock({ loaderData }: Route.ComponentProps) {
  const { block, markdown, previewHref, carrelUrl } = loaderData;
  const fetcher = useFetcher<{ ok: boolean; message?: string }>();

  return (
    <div className="mx-auto max-w-3xl">
      <a
        href="/admin/settings"
        className="inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-ink"
      >
        <Icon d={iconArrowLeft} className="size-3" /> Settings
      </a>
      <h1 className="mt-3 font-display text-2xl font-semibold">{block.title || block.key}</h1>
      <p className="mt-1 font-mono text-xs text-muted">{block.key}</p>

      {markdown && carrelUrl ? (
        <Panel className="mt-6">
          <div className="space-y-2">
            <a
              href={carrelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-xs text-accent hover:underline"
            >
              <Icon d={iconExternal} className="size-[13px]" /> Edit in Carrel
              <span className="cap-sr-only"> (opens in a new tab)</span>
            </a>
            <div className="max-h-[32rem] overflow-y-auto rounded-xl border border-border bg-card p-4">
              <BodyRenderer html={block.html} />
            </div>
          </div>
        </Panel>
      ) : (
        <fetcher.Form method="post" className="mt-6 space-y-5">
          <Panel>
            <div className="space-y-4">
              <Field label="Title">
                {(control) => (
                  <input
                    {...control}
                    name="title"
                    defaultValue={block.title}
                    className="cap-input"
                  />
                )}
              </Field>
              <Field label="Body (plain text)">
                {(control) => (
                  <textarea
                    {...control}
                    name="value"
                    defaultValue={block.value}
                    rows={18}
                    className="cap-input font-mono text-xs"
                  />
                )}
              </Field>
              <Field label="Status">
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
            </div>
          </Panel>

          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" pending={fetcher.state !== "idle"}>
              Save
            </Button>
            {previewHref ? (
              <a
                href={`${previewHref}?preview=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-sm text-accent hover:underline"
              >
                <Icon d={iconExternal} className="size-[13px]" /> Preview
                <span className="cap-sr-only"> (opens in a new tab)</span>
              </a>
            ) : null}
            {fetcher.data?.ok ? (
              <span role="status" className="font-mono text-xs text-accent">
                {fetcher.data.message}
              </span>
            ) : null}
          </div>
        </fetcher.Form>
      )}
    </div>
  );
}
