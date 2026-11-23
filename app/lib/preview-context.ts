import { previewContext } from "@dustinedwards/site-runtime/context";
import type { Post } from "~/db/schema";

// Carrel's preview of a post or a page (app/lib/carrel/adapter.server.ts): set only on the in-process render the preview
// makes (workers/app.ts), never on a reader's request.
export const previewPostContext = previewContext<Post>();

export type PagePreview = { key: string; title: string | null; html: string };
export const draftPageContext = previewContext<PagePreview>();
