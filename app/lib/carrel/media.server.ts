// Carrel's media group: site-api's mediaLibrary over the images in BLOG_IMAGES and their rows in D1 (app/lib/media/).
// The object is the bytes and the public address (/media/<key>, app/lib/images.ts), the `media` row is everything else.
// What is this site's own, and set here: its address and key scheme, its limits and shrink, where a file is used
// (app/lib/media/usage.server.ts), the history copies in BACKUPS under media/revisions/ (never served: /media reads only
// BLOG_IMAGES, app/routes/media.$.ts), the width and height every page sizes a picture by on the object, the re-render
// of the bodies that show a file after its bytes change, the Worker log of each write, and the suggester.
//
// replaceKeepsSize is off on purpose. No page here holds a picture's size of its own: a cover, artwork, avatar and share
// card read the object's width and height when the page is served (app/lib/images.server.ts), and a body's figures are
// sized from the media row when it is rendered and rendered again after each byte change (afterBytes). So a replace, a
// revert or a quarter turn may change the size, and every page follows it.
import {
  pictureLimits,
  PICTURE_RESIZE,
  mediaLibrary,
  mediaVersion,
  type MediaAdapter,
} from "@dustinedwards/site-api";
import { rerenderUsing } from "~/lib/render.server";
import { mediaStore } from "~/lib/media/store.server";
import { suggestFor } from "~/lib/media/suggest.server";
import { mediaPlaces, usesOfKey } from "~/lib/media/usage.server";
import { buildKey, imageUrl } from "~/lib/r2.server";

type Log = (event: string, id: string, version: string, changeId: string) => void;

export function carrelMedia(env: Env, recordChange: Log): MediaAdapter {
  const store = mediaStore(env);
  return mediaLibrary({
    store,
    bucket: env.BLOG_IMAGES,
    images: env.IMAGES,
    limits: pictureLimits(10 * 1024 * 1024),
    resize: PICTURE_RESIZE,
    url: imageUrl,
    // carrel/<ms>-<name>, as before; a taken key tries the name with -2, -3 and on.
    key: (file, attempt) =>
      buildKey(
        "carrel",
        attempt === 1 ? file.filename : file.filename.replace(/(\.[^.]*)?$/, `-${attempt}$1`),
      ),
    history: { bucket: env.BACKUPS, prefix: "media/revisions/" },
    // Every page sizes a picture by these (app/lib/images.server.ts), so they follow each change of its bytes; empty
    // where the binding could not measure it, which every reader takes as no size.
    customMetadata: (record) => ({
      ...(record.filename ? { filename: record.filename } : {}),
      width: record.width && record.height ? String(record.width) : "",
      height: record.width && record.height ? String(record.height) : "",
    }),
    usage: async (keys) => {
      const places = await mediaPlaces(env);
      const asked = keys ?? [...new Set(places.flatMap((p) => [...p.keys]))];
      return new Map(asked.map((key) => [key, usesOfKey(places, key)]));
    },
    // Bodies carry the file's version in their size URLs; re-rendering them is what shows the new picture.
    afterBytes: async (key) => {
      await rerenderUsing(env, key);
    },
    // Carrel's changeId joins its authorship record to this site's history, in the Worker log with the new version.
    onWrite: async ({ op, id, changeId }) => {
      const version =
        op === "delete" ? "deleted" : mediaVersion((await store.record(id))?.rev ?? 0);
      recordChange(`media.${op}`, id, version, changeId);
    },
    suggest: (picture) => suggestFor(env, picture),
  });
}
