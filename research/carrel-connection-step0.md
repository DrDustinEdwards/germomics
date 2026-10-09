# Connect germomics' blog to Carrel: step 0 not confirmed (job_4c307be613fe)

The job says to confirm, before building anything, that germomics.com is served by this project's
Worker (the dustinedwards.info lesson: Carrel got 404 for days because the domain pointed at an old
host). The domain is confirmed as germomics.com. **This step could not be completed from the
session that worked the job, so nothing was built.**

## What I found
- From the cloud session, outbound requests to germomics.com are refused by the environment's proxy
  (`CONNECT tunnel failed, response 403`), so I could not load `/health` or a not-found path and
  compare what answered. No result either way: this is not evidence the domain is wrong.
- `wrangler.jsonc` has no `routes` or `custom_domain` entry, and the repo has no other record of how
  the domain is attached, so the repo cannot answer the question. It is set in the Cloudflare
  dashboard (Worker > Settings > Domains & Routes) if it is attached at all.
- Carrel's package is reachable: `DrDustinEdwards/site-api` has tags up to v0.5.0 (the job names
  v0.2.0; check which one Carrel's contract expects before installing).
- job_b47a6cf0ee20 (dustinedwards.info's connection) was not checked either; I was not allowed to read
  other jobs' outcomes.

## Steps for Dustin (one at a time)
1. Open Cloudflare > Workers & Pages > `germomics` > Settings > Domains & Routes. Confirm
   `germomics.com` is listed as a Custom Domain (or a route) on this Worker, not on an older Pages
   project or another Worker.
2. From any terminal: `curl -sI https://germomics.com/health` should answer 200 with JSON from this
   app (`{"ok":true,"db":"up",...}`), and `curl -sI https://germomics.com/no-such-path-xyz` should
   answer 404 with this app's security headers (`strict-transport-security`,
   `tdm-reservation: 1`). Anything else means the domain points elsewhere.
3. Reply on job_4c307be613fe with the result. If both pass, the job can go ahead as written:
   `@dustinedwards/site-api` mounted at `/api/carrel/v1`, an adapter over the `posts` table and the
   `BLOG_IMAGES` bucket, a separate revocable `CARREL_SITE_KEY`, planted tests, and the conformance
   suite. If either fails, fix the domain first; the route would otherwise be unreachable.

Nothing here changes the site.
