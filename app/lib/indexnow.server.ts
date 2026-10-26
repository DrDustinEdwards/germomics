// Tells IndexNow (Bing, Yandex and the rest) that pages changed: Prelum's submitIndexNow, for Carrel's publishes and the
// admin editor's. A request from any origin but germomics.com (localhost, a preview) sends nothing. Never throws.
import { submitIndexNow } from "@drdustinedwards/site-helpers/indexnow";
import { INDEXNOW_KEY, SITE_ORIGIN } from "~/lib/site";

export function pingIndexNow(paths: string[], request: Request): Promise<boolean> {
  return submitIndexNow({ origin: SITE_ORIGIN, key: INDEXNOW_KEY, urls: paths.map((path) => `${SITE_ORIGIN}${path}`), from: request.url });
}
