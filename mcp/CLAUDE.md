# CLAUDE.md - mcp/ (Germomics Admin)

The repo's CLAUDE.md governs this folder too. The design is Capsid `capsid/research/design-mcp-servers.md` section 5.

## What this is

Germomics Admin: the admin MCP server for germomics.com, its own Cloudflare Worker `germomics-admin-mcp` at
https://admin-mcp.germomics.com/mcp, a wrapper over the site's operator API (`POST /api/operator`,
`app/routes/api.operator.ts`) reached over the `SITE` service binding with the `OPERATOR_TOKEN` bearer. It holds no policy
and no data binding. Own package.json and npm lockfile.

The tools are in `src/tools.ts`, `germomics_` prefixed. Today: `germomics_check_backup` (reads the backup state, uncached) and `germomics_backup_media` (runs the files backup passes now). A new tool needs the operator API to offer it first, and Dustin's yes.

## Security floor (rules 12 and 13)

Each guard has a test marked PLANT; a guard is trusted only after its plant was seen red.

## Commands (in mcp/)

- `npm ci`, `cp wrangler.jsonc.example wrangler.jsonc`, then `npm run typecheck`, `npm test`, `npm run build` (dry run)
- `npm run check:conformance`: the official MCP suite against `.conformance.json`'s baseline (CI's `mcp-conformance` job)
- A merge to main deploys it (`mcp-deploy` in .github/workflows/ci.yml, devkit's worker-deploy.yml, on while CF_DEPLOY is `true`). Never deploy from a session.
