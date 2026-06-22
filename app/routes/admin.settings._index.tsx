// Admin → Settings: edit the single show_config row (channel metadata + iTunes categories +
// funding). Categories + funding are the Tier 2 additions; the channel fields round out a real
// settings page. On the germomics design system, WCAG AA (labels, focus, error states).
import { useState } from "react";
import { useFetcher } from "react-router";
import { Settings, Megaphone, ListTree, Check } from "lucide-react";
import type { Route } from "./+types/admin.settings._index";
import { getEnv } from "~/lib/context.server";
import { getShowConfig, upsertShowConfig } from "~/lib/show.server";
import { Card, Field, Button, inputCx } from "~/components/admin/ui";
import { CategoriesEditor } from "~/components/admin/CategoriesEditor";
import type { PodcastCategory } from "~/db/schema";

export async function loader({ context }: Route.LoaderArgs) {
  return { show: await getShowConfig(getEnv(context)) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const form = await request.formData();

  let categories: PodcastCategory[] = [];
  try {
    categories = JSON.parse(String(form.get("categories") || "[]"));
  } catch {
    categories = [];
  }
  const et = form.get("itunesType");

  await upsertShowConfig(env, {
    title: String(form.get("title") || "").trim() || "germomics",
    description: String(form.get("description") || "").trim(),
    author: String(form.get("author") || "").trim(),
    ownerEmail: String(form.get("ownerEmail") || "").trim(),
    artwork: String(form.get("artwork") || "").trim(),
    language: String(form.get("language") || "en-us").trim(),
    itunesType: et === "serial" ? "serial" : "episodic",
    explicit: form.get("explicit") === "on",
    categories,
    appleCategory: categories[0]?.category || "Science",
    fundingUrl: String(form.get("fundingUrl") || "").trim() || null,
    fundingLabel: String(form.get("fundingLabel") || "").trim() || null,
  });
  return { ok: true as const, message: "Settings saved." };
}

export default function Settings_({ loaderData }: Route.ComponentProps) {
  const { show } = loaderData;
  const fetcher = useFetcher<{ ok: boolean; message?: string }>();
  const [categories, setCategories] = useState<PodcastCategory[]>(show.categories ?? []);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
        <Settings size={22} aria-hidden /> Settings
      </h1>
      <p className="mt-1 text-sm text-muted">Podcast channel metadata, categories, and funding. These drive the feed.</p>

      <fetcher.Form method="post" className="mt-6 space-y-5">
        <input type="hidden" name="categories" value={JSON.stringify(categories)} />

        <Card title="Show" icon={<Megaphone size={15} aria-hidden />}>
          <div className="space-y-4">
            <Field label="Title">
              {({ id }) => <input id={id} name="title" defaultValue={show.title} className={inputCx} />}
            </Field>
            <Field label="Description">
              {({ id }) => <textarea id={id} name="description" defaultValue={show.description} rows={3} className={inputCx} />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Author">
                {({ id }) => <input id={id} name="author" defaultValue={show.author} className={inputCx} />}
              </Field>
              <Field label="Owner email">
                {({ id }) => <input id={id} name="ownerEmail" type="email" defaultValue={show.ownerEmail} className={inputCx} />}
              </Field>
            </div>
            <Field label="Artwork URL" hint="Square cover art (≥ 1400px). Image re-hosting is deferred.">
              {({ id }) => <input id={id} name="artwork" type="url" defaultValue={show.artwork} className={inputCx} />}
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Language">
                {({ id }) => <input id={id} name="language" defaultValue={show.language} className={inputCx} />}
              </Field>
              <Field label="Type">
                {({ id }) => (
                  <select id={id} name="itunesType" defaultValue={show.itunesType} className={inputCx}>
                    <option value="episodic">episodic</option>
                    <option value="serial">serial</option>
                  </select>
                )}
              </Field>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input type="checkbox" name="explicit" defaultChecked={show.explicit} /> Explicit
              </label>
            </div>
          </div>
        </Card>

        <Card title="iTunes categories" icon={<ListTree size={15} aria-hidden />}>
          <CategoriesEditor value={categories} onChange={setCategories} />
        </Card>

        <Card title="Funding">
          <div className="space-y-4">
            <Field label="Funding URL" hint="Leave blank to omit podcast:funding from the feed.">
              {({ id }) => <input id={id} name="fundingUrl" type="url" defaultValue={show.fundingUrl ?? ""} placeholder="https://…" className={inputCx} />}
            </Field>
            <Field label="Funding label" hint="Button text shown by apps (e.g. “Support the show”).">
              {({ id }) => <input id={id} name="fundingLabel" defaultValue={show.fundingLabel ?? ""} className={inputCx} />}
            </Field>
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={fetcher.state !== "idle"}>Save settings</Button>
          {fetcher.data?.ok ? (
            <span role="status" className="flex items-center gap-1 font-mono text-xs text-accent"><Check size={13} aria-hidden /> {fetcher.data.message}</span>
          ) : null}
        </div>
      </fetcher.Form>
    </div>
  );
}
