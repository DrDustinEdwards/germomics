import { lazy, useState } from "react";
import { useFetcher } from "react-router";
import { Trophy } from "lucide-react";
import { pageHead } from "~/lib/seo";
import type { Route } from "./+types/games.$slug";
import { getEnv } from "~/lib/context.server";
import { getGame } from "~/lib/games.server";
import { getLeaderboard, submitScore } from "~/lib/scores.server";
import { ClientOnly } from "~/components/util/ClientOnly";
import { useSnippet } from "~/lib/content";
import { PUBLIC_FORM, readForm } from "~/lib/body.server";

const PhaserGame = lazy(() => import("~/components/game/PhaserGame.client"));

// A game is an app from its first paint (Phaser, the leaderboard), so it hydrates on load (lib/hydration.ts).
export const handle = { hydrate: true };

export function meta({ loaderData, location }: Route.MetaArgs) {
  if (!loaderData?.game) return [{ title: "Games · Germomics" }];
  return pageHead({
    path: location.pathname,
    title: `${loaderData.game.title} · Germomics`,
    description: loaderData.game.tagline,
  });
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const game = getGame(params.slug);
  if (!game) throw new Response("Not found", { status: 404 });
  return { game, leaderboard: await getLeaderboard(env, game.slug) };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const form = await readForm(request, PUBLIC_FORM);
  const ip = request.headers.get("CF-Connecting-IP") ?? "anon";
  return submitScore(env, {
    gameSlug: params.slug,
    name: form.get("name"),
    score: form.get("score"),
    ip,
  });
}

export default function GamePage({ loaderData }: Route.ComponentProps) {
  const { game, leaderboard } = loaderData;
  const fetcher = useFetcher<typeof action>();
  const [lastScore, setLastScore] = useState<number | null>(null);
  const submitted = fetcher.data?.ok === true;
  const emptyScores = useSnippet("snippet:empty.scores", "No scores yet. Be the first.");

  return (
    <div className="mx-auto max-w-3xl">
      <p className="font-mono text-xs uppercase tracking-wide text-accent">Arcade</p>
      <h1 className="mt-2 font-display text-3xl font-semibold">{game.title}</h1>
      <p className="mt-2 text-muted">{game.instructions}</p>

      <div className="mt-6">
        <ClientOnly
          fallback={<div className="mx-auto aspect-[4/3] w-full max-w-[800px] animate-pulse rounded-xl bg-surface" />}
        >
          <PhaserGame slug={game.slug} onScore={setLastScore} />
        </ClientOnly>
      </div>

      {lastScore != null && !submitted ? (
        <fetcher.Form method="post" className="mt-4 flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center">
          <p className="font-display text-sm">
            Run over. <span className="text-brand">{lastScore}</span> bacteria stopped. Save your score:
          </p>
          <input type="hidden" name="score" value={lastScore} />
          <input
            name="name"
            maxLength={20}
            required
            placeholder="name"
            aria-label="Your name for the leaderboard"
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none focus-visible:border-accent"
          />
          <button
            type="submit"
            className="rounded-lg bg-brand px-3 py-1.5 font-display text-sm font-medium text-white hover:bg-brand-strong"
          >
            Submit
          </button>
        </fetcher.Form>
      ) : null}
      {fetcher.data && fetcher.data.ok === false ? (
        <p className="mt-2 text-sm text-accent">{fetcher.data.error}</p>
      ) : null}
      {submitted ? <p className="mt-2 text-sm text-accent">Saved to the leaderboard ↓</p> : null}

      <section className="mt-8">
        <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-semibold">
          <Trophy size={18} className="text-brand" aria-hidden /> Leaderboard
        </h2>
        {leaderboard.length ? (
          <ol className="divide-y divide-border rounded-xl border border-border bg-card">
            {leaderboard.map((s, i) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-2">
                <span className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted">{i + 1}</span>
                  <span className="font-display">{s.name}</span>
                </span>
                <span className="font-mono tabular-nums text-accent">{s.score}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted">{emptyScores}</p>
        )}
      </section>
    </div>
  );
}
