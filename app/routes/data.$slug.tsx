import { pageHead } from "~/lib/seo";
import { sectionPageTrail } from "~/lib/trails";
import { SectionTrail } from "~/components/content/SectionTrail";
import type { Route } from "./+types/data.$slug";
import { datasetSummary, getDataset } from "~/lib/datasets.server";
import { getSnippets } from "~/lib/context.server";
import { dataMap, timelineChart } from "~/lib/charts.server";
import type { Source } from "~/lib/datasets.server";
import chartsCss from "~/charts.css?url";
import { markup } from "capsomer/behavior/trusted-html";

// The map and the chart are drawn on the server by Enarratio, so a data page sends no React (lib/hydration.ts); their
// stylesheet and island (app/islands/charts.ts) load on this route alone.
export const links: Route.LinksFunction = () => [{ rel: "stylesheet", href: chartsCss }];

const dataTrail = (page: { slug: string; title: string }) =>
  sectionPageTrail(
    { name: "Data", path: "/data" },
    { name: page.title, path: `/data/${page.slug}` },
  );

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
    <p className="gm-data-source">
      Source: <a href={source.url}>{source.label}</a>
    </p>
  );
}

function DataTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="gm-data-table">
      <caption className="cap-sr-only">{title}</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c} scope="col" className="gm-data-th">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((cell, j) => (
              <td key={j} className="gm-data-td">
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
    <article className="gm-column">
      <SectionTrail trail={dataTrail(d)} />
      <p className="gm-tag-eyebrow">{d.kind}</p>
      <h1 className="gm-detail-title">{d.title}</h1>
      <p className="gm-index-lede">{d.summary}</p>

      {map ? (
        <div
          className="gm-data-map"
          data-island="charts"
          data-client="visible"
          data-client-root-margin="200px"
          dangerouslySetInnerHTML={markup(map)}
        />
      ) : null}

      {chart ? (
        <div
          className="gm-data-chart"
          data-island="charts"
          data-client="visible"
          data-client-root-margin="200px"
          dangerouslySetInnerHTML={markup(chart)}
        />
      ) : null}

      {d.note ? <p className="gm-data-note">{d.note}</p> : null}

      {d.table ? (
        <section className="gm-data-section">
          <h2 className="gm-data-section-title">{d.table.title}</h2>
          <DataTable title={d.table.title} columns={d.table.columns} rows={d.table.rows} />
          <SourceLine source={d.table.source} />
        </section>
      ) : null}
    </article>
  );
}
