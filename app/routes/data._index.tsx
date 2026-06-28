import { Link } from "react-router";
import { Activity, Dna } from "lucide-react";
import type { Route } from "./+types/data._index";
import { listDatasets } from "~/lib/datasets.server";
import { getSnippets } from "~/lib/context.server";
import { snippet } from "~/lib/content.server";

export function meta() {
  return [
    { title: "Data · Germomics" },
    { name: "description", content: "Interactive maps and charts on viruses and bacteria." },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  const snippets = getSnippets(context);
  const datasets = listDatasets().map((d) => ({
    ...d,
    summary: snippet(snippets, `snippet:dataset.${d.slug}`, d.summary),
  }));
  return { datasets };
}

export default function DataHub({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Data</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Interactive maps and charts on viruses and bacteria. Each page renders a real,
        crawlable summary and data table around the visualization.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {loaderData.datasets.map((d) => (
          <Link
            key={d.slug}
            to={`/data/${d.slug}`}
            className="rounded-xl border border-border bg-card p-5 transition hover:border-brand"
          >
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-accent">
              {d.kind === "virus" ? <Dna size={13} aria-hidden /> : <Activity size={13} aria-hidden />}
              {d.kind}
            </div>
            <h2 className="mt-1 font-display text-lg font-medium text-ink">{d.title}</h2>
            <p className="mt-1 text-sm text-muted">{d.summary}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
