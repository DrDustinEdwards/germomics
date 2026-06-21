import Link from 'next/link';
import { NAV, SITE_NAME } from '@/lib/constants';
import ThemeToggle from '@/components/ThemeToggle';

export default function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-display text-xl font-semibold tracking-tight text-text-primary"
        >
          germ<span className="text-brand">omics</span>
        </Link>

        <div className="flex items-center gap-1">
          <ul className="mr-2 hidden items-center gap-1 sm:flex">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-full px-3 py-2 font-display text-sm text-text-secondary transition-colors hover:text-text-primary"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <span className="sr-only">{SITE_NAME} navigation</span>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}
