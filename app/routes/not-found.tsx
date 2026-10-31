import { goneResponse } from "@dustinedwards/site-runtime/url";
import { GONE } from "~/lib/site";
import type { Route } from "./+types/not-found";

// Every path no route matches (a single segment is the post route's, which answers its own miss through
// posts.server missingPost): a 410 for a path on GONE, else a 404, drawn by the root ErrorBoundary.
export function loader({ request }: Route.LoaderArgs): never {
  throw goneResponse(request, GONE) ?? new Response("Not found", { status: 404 });
}

export default function NotFound() {
  return null;
}
