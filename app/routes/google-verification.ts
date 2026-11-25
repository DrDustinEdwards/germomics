// Google Search Console ownership proof. DO NOT REMOVE OR RENAME: Google re-requests this URL and drops the
// verification, and the site's search data with it, if it stops returning the line below.
// A resource route, not a file in public/: Static Assets' html_handling redirects /name.html to /name, but Search
// Console asks for the .html URL. It sorts above the `:slug` catch-all in app/routes.ts. The token is public by design.

const BODY = "google-site-verification: google7e6923f5a0eb8ba9.html\n";

export async function loader() {
  return new Response(BODY, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
