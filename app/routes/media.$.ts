// Every picture: /media/<key> is the BLOG_IMAGES original, and /media/<key>?w=<width>[&f=avif][&r=<crop>]
// one size of it, made by the Images binding and cached at the edge (site-runtime's `images.serve`), as on
// dustinedwards.info. Only the widths and crops in app/lib/images.ts are served; anything else is a 400, never a
// billed transform.
import type { Route } from "./+types/media.$";
import { getEnv } from "~/lib/context.server";
import { IMMUTABLE_CACHE } from "@dustinedwards/site-runtime/image";
import { images } from "~/lib/images";

export function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  return images.serve(request, {
    read: (key) => env.BLOG_IMAGES.get(key),
    images: env.IMAGES,
    // `caches.default` is the Workers runtime's; the DOM lib does not declare it.
    cache: (caches as typeof caches & { default: Cache }).default,
    cacheControl: IMMUTABLE_CACHE,
  });
}
