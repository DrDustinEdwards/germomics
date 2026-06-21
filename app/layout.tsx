import type { Metadata } from 'next';
import { Space_Grotesk, Fraunces, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { baseMetadata } from '@/lib/metadata';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';

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
        <Nav />
        <main className="mx-auto max-w-5xl px-6">{children}</main>
        <Footer />
        {/* The persistent queue player mounts here in the player build step. */}
      </body>
    </html>
  );
}
