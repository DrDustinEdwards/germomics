import { lazy } from "react";
import type { Route } from "./+types/data.$slug";
import { getDataset } from "~/lib/datasets.server";
import { getSnippets } from "~/lib/context.server";
import { snippet } from "~/lib/content.server";
import { ClientOnly } from "~/components/util/ClientOnly";

// Heavy viz libs are lazy() — Vite code-splits them onto this route only.
const DataMap = lazy(() => import("~/components/data/DataMap.client"));
const DataChart = lazy(() => import("~/components/data/DataChart.client"));

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData?.dataset) return [{ title: "Data · Germomics" }];
  return [
    { title: `${loaderData.dataset.title} · Germomics` },
    { name: "description", content: loaderData.dataset.summary },
  ];
}

export function loader({ params, context }: Route.LoaderArgs) {
  const dataset = getDataset(params.slug);
  if (!dataset) throw new Response("Not found", { status: 404 });
  const summary = snippet(getSnippets(context), `snippet:dataset.${dataset.slug}`, dataset.summary);
  return { dataset: { ...dataset, summary } };
}

function DataTable({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">Data table</caption>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c} scope="col" className="border-b border-border py-2 text-left font-display text-muted">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((cell, j) => (
              <td key={j} className="border-b border-border py-2 tabular-nums">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function DataDetail({ loaderData }: Route.ComponentProps) {
  const d = loaderData.dataset;
  return (
    <article className="mx-auto max-w-3xl">
      <p className="font-mono text-xs uppercase tracking-wide text-accent">{d.kind}</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">{d.title}</h1>
      <p className="mt-2 max-w-2xl text-muted">{d.summary}</p>

      {d.map ? (
        <div className="mt-8">
          <ClientOnly fallback={<div className="h-80 w-full animate-pulse rounded-xl bg-surface" />}>
            <DataMap center={d.map.center} zoom={d.map.zoom} points={d.map.points} />
          </ClientOnly>
        </div>
      ) : null}

      {d.timeline ? (
        <div className="mt-6">
          <ClientOnly fallback={<div className="h-72 w-full animate-pulse rounded-xl bg-surface" />}>
            <DataChart data={d.timeline} unit={d.unit} />
          </ClientOnly>
        </div>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-2 font-display text-lg font-semibold">The data</h2>
        <DataTable columns={d.table.columns} rows={d.table.rows} />
      </section>
    </article>
  );
}
