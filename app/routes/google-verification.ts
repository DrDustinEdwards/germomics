// /google7e6923f5a0eb8ba9.html — Google Search Console ownership proof for germomics.com.
//
// DO NOT REMOVE AND DO NOT RENAME. Google re-requests this exact URL periodically and drops the
// property's verification if it stops returning the line below. Losing verification loses
// Search Console access to the site's search data.
//
// A RESOURCE ROUTE RATHER THAN A FILE IN public/, deliberately. Workers Static Assets' default
// html_handling ("auto-trailing-slash") redirects a request for /name.html to the extensionless
// /name, and Search Console asks for the .html URL. Serving it from the Worker returns 200 at
// the path Google actually requests. It also sorts above the `:slug` catch-all in app/routes.ts,
// so it never falls through to the article lookup.
//
// The token is public by design: it proves control of the site, it is not a secret.
import { HOURLY_CACHE_CONTROL } from "~/lib/edge-cache.server";

const BODY = "google-site-verification: google7e6923f5a0eb8ba9.html\n";

export async function loader() {
  return new Response(BODY, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": HOURLY_CACHE_CONTROL,
    },
  });
}
