// lib/auth.ts Auth.js v5, Google provider, single allowlisted admin, JWT sessions.
// No database adapter: sessions are stateless JWTs, so D1 stays purely content (no auth
// tables). Runs on workerd (Auth.js v5 uses Web Crypto). trustHost is required off-Vercel.
//
// Env (Worker secrets / .dev.vars): AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET,
// ADMIN_EMAIL. On OpenNext these are exposed through process.env at runtime.

import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: { strategy: 'jwt' },
  trustHost: true,
  callbacks: {
    // Gate sign-in to the single allowlisted address.
    signIn({ profile }) {
      const allowed = process.env.ADMIN_EMAIL?.toLowerCase();
      const email = profile?.email?.toLowerCase();
      const verified = (profile as { email_verified?: boolean } | undefined)?.email_verified;
      return Boolean(allowed && email && email === allowed && verified);
    },
    // Protect the /admin surface via middleware.
    authorized({ auth: session }) {
      return Boolean(session?.user);
    },
  },
});
