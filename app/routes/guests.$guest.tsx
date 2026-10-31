import { pageHead } from "~/lib/seo";
import type { Route } from "./+types/guests.$guest";
import { getEnv } from "~/lib/context.server";
import { postsByGuest, slugifyGuest, toPlayerTrack } from "~/lib/posts.server";
import { getPersonBySlug, postsByPerson } from "~/lib/people.server";
import { PostCard } from "~/components/content/PostCard";
import { QueueSeeder } from "~/components/content/QueueSeeder";
import { Picture } from "~/components/content/Picture";
import { imageFor } from "~/lib/images";
import { imageSet, shareImage } from "~/lib/images.server";

export function meta({ loaderData, location }: Route.MetaArgs) {
  const name = loaderData?.name ?? "Guest";
  return pageHead({
    path: location.pathname,
    title: `${name} · Germomics`,
    description: `Germomics episodes with ${name}.`,
    pageType: "CollectionPage",
    image: loaderData?.share,
  });
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = getEnv(context);

  // Prefer the People entity; fall back to the legacy guests-JSON resolver.
  const person = await getPersonBySlug(env, params.guest);
  const [byPerson, byLegacy] = await Promise.all([
    person ? postsByPerson(env, params.guest) : Promise.resolve([]),
    postsByGuest(env, params.guest),
  ]);

  // Merge + dedupe, newest first.
  const seen = new Set<number>();
  const episodes = [...byPerson, ...byLegacy]
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .sort((a, b) => String(b.publishedAt ?? "").localeCompare(String(a.publishedAt ?? "")));

  const legacy = episodes.flatMap((e) => e.guests ?? []).find((g) => slugifyGuest(g.name) === params.guest);
  const name = person?.name ?? legacy?.name ?? params.guest;
  const photo = person?.photo ? { src: person.photo, alt: person.photoAlt ?? name } : null;

  return {
    name,
    role: person?.role ?? legacy?.role ?? null,
    bio: person?.bio ?? legacy?.bio ?? null,
    photo: person?.photo ?? null,
    photoAlt: person?.photoAlt ?? null,
    links: person?.links ?? (legacy?.link ? [{ label: "Website", url: legacy.link }] : []),
    episodes,
    tracks: episodes.map(toPlayerTrack),
    images: await imageSet(env, [["portrait", person?.photo]]),
    share: await shareImage(env, photo),
  };
}

export default function GuestPage({ loaderData }: Route.ComponentProps) {
  const { name, role, bio, photo, photoAlt, links, episodes, tracks, images } = loaderData;
  return (
    <div>
      <QueueSeeder tracks={tracks} />
      <p className="font-mono text-xs uppercase tracking-wide text-accent">Guest</p>
      <div className="mb-6 mt-2 flex items-start gap-4">
        {photo ? (
          <Picture src={photo} image={imageFor(images, "portrait", photo)} alt={photoAlt ?? name} className="h-16 w-16 rounded-full border border-border object-cover" />
        ) : null}
        <div>
          <h1 className="font-display text-3xl font-semibold">{name}</h1>
          {role ? <p className="font-mono text-xs text-muted">{role}</p> : null}
          {bio ? <p className="mt-2 max-w-2xl text-muted">{bio}</p> : null}
          {links.length ? (
            <div className="mt-2 flex flex-wrap gap-3 font-mono text-xs">
              {links.map((l) => (
                <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{l.label || "link"}</a>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div className="grid gap-3">
        {episodes.map((post) => (
          <PostCard key={post.id} post={post} queue={tracks} heading="h2" />
        ))}
        {episodes.length === 0 ? <p className="text-muted">No episodes with this guest.</p> : null}
      </div>
    </div>
  );
}
