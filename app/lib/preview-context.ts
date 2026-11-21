import { createContext } from "react-router";
import type { Post } from "~/db/schema";

// Carrel's preview of a post or a page (app/lib/carrel/adapter.server.ts): set only on the in-process render the preview
// makes (workers/app.ts), never on a reader's request, so the route shows the draft in place of the stored row. The
// default is null, not undefined: React Router's get() throws for a context with no default that nothing set, which is
// every reader's request.
export const postPreviewContext = createContext<Post | null>(null);

export type PagePreview = { key: string; title: string | null; html: string };
export const pagePreviewContext = createContext<PagePreview | null>(null);
