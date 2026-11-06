import { pageHead } from "~/lib/seo";
import { sectionPageTrail } from "~/lib/trails";
import { SectionTrail } from "~/components/content/SectionTrail";
import type { Route } from "./+types/data.$slug";
import { datasetSummary, getDataset } from "~/lib/datasets.server";
import { getSnippets } from "~/lib/context.server";
import { dataMap, timelineChart } from "~/lib/charts.server";
import type { Source } from "~/lib/datasets.server";
import chartsCss from "~/charts.css?url";

// The map and the chart are drawn on the server by Enarratio, so a data page sends no React (lib/hydration.ts); their
// stylesheet and island (app/islands/charts.ts) load on this route alone.
export const links: Route.LinksFunction = () => [{ rel: "stylesheet", href: chartsCss }];

const dataTrail = (page: { slug: string; title: string }) =>
  sectionPageTrail({ name: "Data", path: "/data" }, { name: page.title, path: `/data/${page.slug}` });

export function meta({ loaderData, location }: Route.MetaArgs) {
  if (!loaderData?.dataset) return [{ title: "Data · Germomics" }];
  return pageHead({
    path: location.pathname,
    title: `${loaderData.dataset.title} · Germomics`,
    description: loaderData.dataset.summary,
    breadcrumbs: dataTrail(loaderData.dataset),
  });
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const dataset = getDataset(params.slug);
  if (!dataset) throw new Response("Not found", { status: 404 });
  const summary = datasetSummary(await getSnippets(context), dataset.slug, dataset.summary);
  const map = dataset.map ? dataMap(dataset.slug, dataset.map) : null;
  const chart = dataset.timeline ? timelineChart(dataset.slug, dataset.timeline) : null;
  // The map's points travel as its drawing and table, not again as loader data.
  return { dataset: { ...dataset, map: null, summary }, map, chart };
}

/** Where a table's numbers come from, as the chart's own source line reads. */
function SourceLine({ source }: { source: Source }) {
  return (
    <p className="mt-2 font-display text-xs text-muted">
      Source: <a href={source.url}>{source.label}</a>
    </p>
  );
}

function DataTable({ title, columns, rows }: { title: string; columns: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">{title}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c} scope="col" className="border-b border-border py-2 pr-3 text-left align-bottom font-display text-muted">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((cell, j) => (
              <td key={j} className="border-b border-border py-2 pr-3 align-top tabular-nums">
                {typeof cell === "number" ? cell.toLocaleString("en-GB") : cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function DataDetail({ loaderData }: Route.ComponentProps) {
  const { dataset: d, map, chart } = loaderData;
  return (
    <article className="mx-auto max-w-3xl">
      <SectionTrail trail={dataTrail(d)} />
      <p className="font-mono text-xs uppercase tracking-wide text-accent">{d.kind}</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">{d.title}</h1>
      <p className="mt-2 max-w-2xl text-muted">{d.summary}</p>

      {map ? (
        <div
          className="mt-8 rounded-xl border border-border bg-card p-3"
          data-island="charts"
          data-client="visible"
          data-client-root-margin="200px"
          dangerouslySetInnerHTML={{ __html: map }}
        />
      ) : null}

      {chart ? (
        <div
          className="mt-6 rounded-xl border border-border bg-card p-3"
          data-island="charts"
          data-client="visible"
          data-client-root-margin="200px"
          dangerouslySetInnerHTML={{ __html: chart }}
        />
      ) : null}

      {d.note ? <p className="mt-6 max-w-2xl text-muted">{d.note}</p> : null}

      {d.table ? (
        <section className="mt-8">
          <h2 className="mb-2 font-display text-lg font-semibold">{d.table.title}</h2>
          <DataTable title={d.table.title} columns={d.table.columns} rows={d.table.rows} />
          <SourceLine source={d.table.source} />
        </section>
      ) : null}
    </article>
  );
}
