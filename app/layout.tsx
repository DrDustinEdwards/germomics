import type { Metadata } from 'next';
import { Space_Grotesk, Fraunces, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { baseMetadata } from '@/lib/metadata';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import PlayerProvider from '@/components/player/PlayerProvider';
import PlayerBar from '@/components/player/PlayerBar';

const display = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
  display: 'swap',
});
const serif = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = baseMetadata;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${serif.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        {/* No-flash theme: set data-theme before paint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <PlayerProvider>
          <Nav />
          {/* Extra bottom padding so the docked player never obscures content/focus. */}
          <main className="mx-auto max-w-5xl px-6 pb-36">{children}</main>
          <Footer />
          <PlayerBar />
        </PlayerProvider>
      </body>
    </html>
  );
}
