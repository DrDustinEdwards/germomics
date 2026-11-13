import { lazy, useState } from "react";
import { useFetcher } from "react-router";
import { Trophy } from "lucide-react";
import { pageHead } from "~/lib/seo";
import { sectionPageTrail } from "~/lib/trails";
import { SectionTrail } from "~/components/content/SectionTrail";
import type { Route } from "./+types/games.$slug";
import { cloudflareContext, getEnv } from "@dustinedwards/site-runtime/context";
import { clientIp } from "@dustinedwards/site-runtime/http";
import { gameCacheTag, getGame } from "~/lib/games.server";
import { getLeaderboard, submitScore } from "~/lib/scores.server";
import { ClientOnly } from "capsomer/react/hooks";
import { useSnippet } from "~/lib/content";
import { readForm } from "@dustinedwards/site-runtime/body";
import { PUBLIC_FORM } from "~/lib/body.server";

const PhaserGame = lazy(() => import("~/components/game/PhaserGame.client"));

// A game is an app from its first paint (Phaser, the leaderboard), so it hydrates on load (lib/hydration.ts).
export const handle = { hydrate: true };

const gameTrail = (page: { slug: string; title: string }) =>
  sectionPageTrail(
    { name: "Games", path: "/games" },
    { name: page.title, path: `/games/${page.slug}` },
  );

export function meta({ loaderData, location }: Route.MetaArgs) {
  if (!loaderData?.game) return [{ title: "Games · Germomics" }];
  return pageHead({
    path: location.pathname,
    title: `${loaderData.game.title} · Germomics`,
    description: loaderData.game.tagline,
    breadcrumbs: gameTrail(loaderData.game),
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
  const result = await submitScore(env, {
    gameSlug: params.slug,
    name: form.get("name"),
    score: form.get("score"),
    ip: clientIp(request),
  });
  // A score changes this game's leaderboard only, so only its stored page is purged.
  if (result.ok) {
    const { ctx } = context.get(cloudflareContext);
    ctx.waitUntil(
      ctx.exports.Renderer.purgePages(`score /games/${params.slug}`, [gameCacheTag(params.slug)]),
    );
  }
  return result;
}

export default function GamePage({ loaderData }: Route.ComponentProps) {
  const { game, leaderboard } = loaderData;
  const fetcher = useFetcher<typeof action>();
  const [lastScore, setLastScore] = useState<number | null>(null);
  const submitted = fetcher.data?.ok === true;
  const emptyScores = useSnippet("snippet:empty.scores", "No scores yet. Be the first.");

  return (
    <div className="gm-column">
      <SectionTrail trail={gameTrail(game)} />
      <p className="gm-tag-eyebrow">Arcade</p>
      <h1 className="gm-detail-title">{game.title}</h1>
      <p className="gm-lede">{game.instructions}</p>

      <div className="gm-game-stage">
        <ClientOnly fallback={<div className="gm-game-skeleton" />}>
          <PhaserGame slug={game.slug} onScore={setLastScore} />
        </ClientOnly>
      </div>

      {lastScore != null && !submitted ? (
        <fetcher.Form method="post" className="gm-game-save">
          <p className="gm-game-save-label">
            Run over. <span className="gm-brand">{lastScore}</span> bacteria stopped. Save your
            score:
          </p>
          <input type="hidden" name="score" value={lastScore} />
          <input
            name="name"
            maxLength={20}
            required
            placeholder="name"
            aria-label="Your name for the leaderboard"
            className="gm-game-input"
          />
          <button type="submit" className="gm-game-button">
            Submit
          </button>
        </fetcher.Form>
      ) : null}
      {fetcher.data && fetcher.data.ok === false ? (
        <p className="gm-form-note">{fetcher.data.error}</p>
      ) : null}
      {submitted ? <p className="gm-form-note">Saved to the leaderboard ↓</p> : null}

      <section className="gm-game-scores">
        <h2 className="gm-game-scores-title">
          <Trophy size={18} className="gm-brand" aria-hidden /> Leaderboard
        </h2>
        {leaderboard.length ? (
          <ol className="gm-scores">
            {leaderboard.map((s, i) => (
              <li key={s.id} className="gm-score">
                <span className="gm-score-who">
                  <span className="gm-meta-text">{i + 1}</span>
                  <span className="gm-score-name">{s.name}</span>
                </span>
                <span className="gm-score-value">{s.score}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="gm-muted">{emptyScores}</p>
        )}
      </section>
    </div>
  );
}
