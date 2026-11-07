import { Suspense, useSyncExternalStore, type ReactNode } from "react";

const noSubscribe = () => () => {};

// Renders `fallback` on the server and the first client render (matching SSR — no hydration
// mismatch), then mounts `children` after hydration inside Suspense. Used to keep window-only,
// lazily-imported libraries (MapLibre, Phaser) off the server and out of the shared
// client chunk — the fallback doubles as the accessible text equivalent.
export function ClientOnly({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  // False on the server and while hydrating, true once hydrated (React's server snapshot, then the client's).
  const mounted = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  if (!mounted) return <>{fallback}</>;
  return <Suspense fallback={fallback}>{children}</Suspense>;
}
