import { Link } from "capsomer/react/link";
import { Icon, iconActivity, iconDna } from "capsomer/react/icons";
import { pageHead } from "~/lib/seo";
import type { Route } from "./+types/data._index";
import { listDatasets } from "~/lib/datasets.server";

export function meta() {
  return pageHead({
    path: "/data",
    title: "Data · Germomics",
    description:
      "Interactive maps and charts from Germomics on viruses and bacteria, each with a data table that carries the same numbers.",
    pageType: "CollectionPage",
  });
}

export function loader() {
  return { datasets: listDatasets() };
}

export default function DataHub({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <h1 className="gm-page-title">Data</h1>
      <div className="gm-index-grid">
        {loaderData.datasets.map((d) => (
          <Link key={d.slug} to={`/data/${d.slug}`} className="gm-index-card">
            <div className="gm-index-kind">
              <Icon d={d.kind === "virus" ? iconDna : iconActivity} />
              {d.kind}
            </div>
            <h2 className="gm-index-card-title">{d.title}</h2>
            <p className="gm-index-card-text">{d.summary}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
