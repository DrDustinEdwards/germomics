import Link from 'next/link';
import { NAV, PODCAST_FEED_PATH, SITE_NAME } from '@/lib/constants';

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-xs text-text-tertiary">
          {SITE_NAME} · microbiology and history
        </p>
        <ul className="flex flex-wrap gap-4 font-display text-sm text-text-secondary">
          {NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="transition-colors hover:text-text-primary">
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <a href={PODCAST_FEED_PATH} className="transition-colors hover:text-text-primary">
              RSS
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
