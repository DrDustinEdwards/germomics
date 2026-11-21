import type { RenderDocument } from "~/lib/carrel/adapter.server";

/** The site's render of a route (workers/app.ts), reduced to a shell around the draft it is given, as a test sees it. */
export const renderDocument: RenderDocument = async (_request, draft) => {
  const [title, html] =
    "post" in draft
      ? [draft.post.title, draft.post.bodyHtml ?? ""]
      : [draft.page.title ?? "", draft.page.html];
  return new Response(
    `<!doctype html><html><head></head><body><h1>${title}</h1>${html}</body></html>`,
  );
};
