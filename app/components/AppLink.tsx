import { forwardRef } from "react";
import { Link, type LinkProps } from "react-router";

// Internal-link wrapper: same API as React Router's <Link>, but defaults prefetch="intent" so the
// target route's module + loader data are fetched on hover/focus (a <link rel="prefetch"> is injected
// on intent), making in-app navigation feel instant. Use ONLY for internal navigation. External links
// (social, podcast directories, RSS, txasm.org) stay plain <a>, and resource routes (feeds, sitemap)
// are never prefetched. Callers can still override prefetch per link (e.g. "viewport" or "none").
export const AppLink = forwardRef<HTMLAnchorElement, LinkProps>(function AppLink(
  { prefetch = "intent", ...props },
  ref,
) {
  return <Link ref={ref} prefetch={prefetch} {...props} />;
});
