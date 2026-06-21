import { Suspense, useEffect, useState, type ReactNode } from "react";

// Renders `fallback` on the server and the first client render (matching SSR — no hydration
// mismatch), then mounts `children` after hydration inside Suspense. Used to keep window-only,
// lazily-imported libraries (MapLibre, Recharts, Phaser) off the server and out of the shared
// client chunk — the fallback doubles as the accessible text equivalent.
export function ClientOnly({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <>{fallback}</>;
  return <Suspense fallback={fallback}>{children}</Suspense>;
}
