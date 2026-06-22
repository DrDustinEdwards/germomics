import { Link } from "react-router";
import { Gamepad2 } from "lucide-react";
import type { Route } from "./+types/games._index";
import { listGames } from "~/lib/games.server";

export function meta() {
  return [
    { title: "Games · germomics" },
    { name: "description", content: "Arcade browser games tied to the microbiology content." },
  ];
}

export function loader(_: Route.LoaderArgs) {
  return { games: listGames() };
}

export default function GamesHub({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Games</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Small arcade games that tie into the microbiology. Each loads its engine only when you
        open it.
      </p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {loaderData.games.map((g) => (
          <Link
            key={g.slug}
            to={`/games/${g.slug}`}
            className="rounded-xl border border-border bg-card p-5 transition hover:border-brand"
          >
            <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-accent">
              <Gamepad2 size={13} aria-hidden /> arcade
            </div>
            <h2 className="mt-1 font-display text-lg font-medium text-ink">{g.title}</h2>
            <p className="mt-1 text-sm text-muted">{g.tagline}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
