# germomics

germomics.com: a podcast and writing site about microbiology and history, with interactive data pages and browser games. React Router 8 on Cloudflare Workers, with D1, R2 and KV. Private.

How to work in this repo: `CLAUDE.md`. What the site is and why: `docs/germomics_build_plan.html`.

```sh
npm ci
npm run dev        # Vite in workerd, bindings local
npm run typecheck && npm test
```

A merge to `main` deploys to production (Cloudflare Workers Builds).
