// Resized images: /media/<key> is the BLOG_IMAGES original, and /media/<key>?w=<width>[&f=avif][&r=<crop>]
// one size of it, made by the Images binding and cached at the edge (site-runtime's `respond`).
// Only the widths and crops in app/lib/images.ts are served; anything else is a 400, never a
// billed transform. The originals stay at images.germomics.com too, so every URL already in a
// published body or feed keeps working.
import type { Route } from "./+types/media.$";
import { getEnv } from "~/lib/context.server";
import { originalKey } from "@dustinedwards/site-runtime/image";
import { images } from "~/lib/images";

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const path = params["*"];
  if (!path) return new Response("Not found", { status: 404 });
  // A size URL ends in its own format (`photo.jpg.webp?w=640`); the stored key is `photo.jpg`.
  const key = originalKey(path, request);
  const env = getEnv(context);
  const read = () => env.BLOG_IMAGES.get(key);
  return images.respond(request, {
    object: await read(),
    images: env.IMAGES,
    // `caches.default` is the Workers runtime's; the DOM lib does not declare it.
    cache: (caches as typeof caches & { default: Cache }).default,
    reread: read,
  });
}
