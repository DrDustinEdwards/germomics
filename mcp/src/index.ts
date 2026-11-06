/**
 * Germomics Admin: the admin MCP server for germomics.com.
 *
 * Ruling capsid/rulings/mcp-2026-10-10.md and capsid/research/design-mcp-servers.md section 5. Its own Worker (rule 9
 * as amended): it holds no D1 and no Germomics data binding (its one R2 bucket holds only copies of its own tool-call
 * log). Its only route to Germomics is the SITE service binding to POST /api/operator, which owns every rule. If this
 * Worker vanished, nothing about what is allowed on germomics.com would change.
 *
 * The Worker is site-runtime's adminMcpWorker, the door every admin MCP server shares: the Origin and Host checks, the
 * list-only test key, the OAuth provider bound to PUBLIC_ORIGIN + /mcp, the Cloudflare Access sign-in admitting the
 * single ADMIN_EMAIL (on every request too), the rate limit, /owner, /health and the tool-call log's daily copy. What
 * is Germomics' own is below: its name, its consent paragraphs, its binding and its MCP server (mcp-handler.ts).
 *
 * Access, independent of germomics.com's own admin sign-in (also Access, a different application). The API leg is the
 * OPERATOR_TOKEN bearer (src/api-client.ts), not the person's identity.
 */

import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { adminMcpWorker, type AdminMcpEnv } from "@dustinedwards/site-runtime/admin-mcp";
import { germomicsMcp } from "@dustinedwards/site-runtime/sites";

import type { ApiEnv } from "./api-client";
import { handleMcp, SERVER } from "./mcp-handler";

export { RateLimiter as McpRateLimit } from "@dustinedwards/site-runtime/rate-limit/durable-object";
export { ToolCallLog } from "@dustinedwards/site-runtime/audit-log";

export interface Env extends AdminMcpEnv, Partial<ApiEnv> {}

export default adminMcpWorker<Env>({
  name: "Germomics Admin",
  server: SERVER,
  site: germomicsMcp,
  securityTxt: { contact: "security@dustinedwards.info", expires: "2027-09-28T00:00:00Z" },
  about: `<p>Germomics Admin runs germomics.com. Today it backs up the site's files now: the episode audio, the
images and the game assets. It cannot write posts or pages; Carrel owns writing.</p>
<p>It will always be able to read. Changes need the box below.</p>`,
  // The service binding is checked by presence only: a request over it would be an operator API call.
  api: { binding: "SITE", name: "germomics" },
  OAuthProvider,
  serve: (request, env, ctx, caller) => handleMcp(request, env, ctx, caller),
});
