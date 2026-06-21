// Gate every /admin route behind a signed-in session. The single allowlisted email is
// enforced in lib/auth's signIn callback; here we only require an authenticated session.
// /admin/signin is left open so there is no redirect loop.

import { auth } from '@/lib/auth';

export default auth((req) => {
  const { pathname, origin } = req.nextUrl;
  if (pathname === '/admin/signin') return;
  if (!req.auth) {
    return Response.redirect(new URL('/admin/signin', origin));
  }
});

export const config = {
  matcher: ['/admin/:path*'],
};
