// Carrel's media group: site-api's mediaLibrary over BLOG_IMAGES and the `media` rows in D1 (app/lib/media/). The
// object holds the bytes and public address; the row holds the rest. History copies live in BACKUPS under
// media/revisions/ and are never served (/media reads only BLOG_IMAGES).
// replaceKeepsSize is off on purpose: no page holds a picture's size of its own. Covers and avatars read the object's
// width and height at serve time, and body figures are re-rendered after each byte change (afterBytes).
import {
  d1MediaStore,
  pictureLimits,
  PICTURE_RESIZE,
  mediaLibrary,
  mediaVersion,
  type MediaAdapter,
} from "@dustinedwards/site-api";
import { rerenderUsing } from "~/lib/render.server";
import { suggestFor } from "~/lib/media/suggest.server";
import { mediaPlaces, usesOfKey } from "~/lib/media/usage.server";
import { buildKey, imageUrl } from "~/lib/r2.server";

type Log = (event: string, id: string, version: string, changeId: string) => void;

export function carrelMedia(env: Env, recordChange: Log): MediaAdapter {
  const store = d1MediaStore(env.DB);
  return mediaLibrary({
    store,
    bucket: env.BLOG_IMAGES,
    images: env.IMAGES,
    limits: pictureLimits(10 * 1024 * 1024),
    resize: PICTURE_RESIZE,
    url: imageUrl,
    // carrel/<ms>-<name>; a taken key tries the name with -2, -3 and on.
    key: (file, attempt) =>
      buildKey(
        "carrel",
        attempt === 1 ? file.filename : file.filename.replace(/(\.[^.]*)?$/, `-${attempt}$1`),
      ),
    history: { bucket: env.BACKUPS, prefix: "media/revisions/" },
    // Empty where the binding could not measure it, which every reader takes as no size.
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
    afterBytes: async (key) => {
      await rerenderUsing(env, key);
    },
    // Carrel's changeId joins its authorship record to this site's history via the Worker log.
    onWrite: async ({ op, id, changeId }) => {
      const version =
        op === "delete" ? "deleted" : mediaVersion((await store.record(id))?.rev ?? 0);
      recordChange(`media.${op}`, id, version, changeId);
    },
    suggest: (picture) => suggestFor(env, picture),
  });
}
