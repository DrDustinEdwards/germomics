import { Link } from "capsomer/react/link";
import { Icon, iconGamepad } from "capsomer/react/icons";
import { pageHead } from "~/lib/seo";
import type { Route } from "./+types/games._index";
import { listGames } from "~/lib/games.server";

export function meta() {
  return pageHead({
    path: "/games",
    title: "Games · Germomics",
    description:
      "Free arcade games from Germomics that play in the browser, tied to its microbiology stories, each with a high-score board.",
    pageType: "CollectionPage",
  });
}

export function loader() {
  return { games: listGames() };
}

export default function GamesHub({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <h1 className="gm-page-title">Games</h1>
      <p className="gm-index-lede">
        Small arcade games that tie into the microbiology. Each loads its engine only when you open
        it.
      </p>
      <div className="gm-index-grid">
        {loaderData.games.map((g) => (
          <Link key={g.slug} to={`/games/${g.slug}`} className="gm-index-card">
            <div className="gm-index-kind">
              <Icon d={iconGamepad} /> arcade
            </div>
            <h2 className="gm-index-card-title">{g.title}</h2>
            <p className="gm-index-card-text">{g.tagline}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
