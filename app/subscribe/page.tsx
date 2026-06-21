import { db } from '@/lib/db';
import { showConfig } from '@/db/schema';
import { PODCAST_FEED_PATH, SITE_FEED_PATH } from '@/lib/constants';
import { pageMetadata } from '@/lib/metadata';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata({
  title: 'Subscribe',
  description: 'Follow germomics in your podcast app, or by RSS.',
  path: '/subscribe',
});

export default async function SubscribePage() {
  const show = (await db.select().from(showConfig).limit(1))[0];
  const links = Object.entries(show?.subscribeLinks ?? {});

  return (
    <div className="py-12">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-text-primary">
        Subscribe
      </h1>
      <p className="mt-4 max-w-xl text-text-secondary">
        New episodes land in your app automatically. The feed lives at a permanent address,
        so it keeps working no matter where you listen.
      </p>

      {links.length ? (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {links.map(([name, url]) => (
            <li key={name}>
              <a
                href={url}
                className="block rounded-2xl border border-border bg-card px-5 py-4 font-display text-text-primary transition-colors hover:border-brand"
              >
                {name}
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-4 font-mono text-sm">
        <a href={PODCAST_FEED_PATH} className="text-accent underline-offset-4 hover:underline">
          Podcast RSS
        </a>
        <a href={SITE_FEED_PATH} className="text-accent underline-offset-4 hover:underline">
          Writing RSS
        </a>
      </div>
    </div>
  );
}
