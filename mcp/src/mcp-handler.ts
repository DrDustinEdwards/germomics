/**
 * The MCP server and its era routing.
 *
 * The primary handler is `legacy: "reject"`: stateless-native 2026-07-28. Prior
 * era traffic is diverted by site-runtime's routeMcpEra, whose header carries the
 * shim's removal condition: drop `isLegacyRequest` below to go modern-only.
 */

import { mcpCacheHints, registerTools, routeMcpEra, type McpServerInfo } from "@dustinedwards/site-runtime/mcp-server";
import { isLegacyRequest, McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";

import { SCOPES, type Caller } from "./auth";
import { TOOLS, type ToolEnv } from "./tools";

export const MCP_ROUTE = "/mcp";

export const SERVER_INFO = {
  name: "germomics-admin-mcp",
  title: "Germomics Admin",
  version: "0.2.0",
  websiteUrl: "https://germomics.com",
  icons: [{ src: "https://germomics.com/icon.svg", mimeType: "image/svg+xml" }],
};

/** This server as refusals, the step-up challenge and the tool-call log name it. */
export const SERVER: McpServerInfo = { site: "germomics.com", scopes: SCOPES, name: SERVER_INFO.name, version: SERVER_INFO.version };

const INSTRUCTIONS =
  "Runs germomics.com for its administrator. Today it covers the site's backups: check their state now, and back up the " +
  "site's files now (the episode audio, the images and the game assets) into the backups bucket, which Capsid copies to " +
  "Amazon. Every call becomes an authenticated request to Germomics' operator API, which owns every rule; this server " +
  "enforces none of its own, so relay a refusal as the API wrote it. It does not write posts or pages: Carrel owns all writing.";

/** The server factory, called per request: no instance outlives the call that made it. */
function buildServer(env: ToolEnv, caller: Caller | undefined) {
  return () => {
    // The element cap on tool arguments (GHSA-46jr-4wx8-v453): the SDK leaves it off by default.
    // Results are per administrator, so every cache hint is private; the list changes only on deploy.
    const server = new McpServer(SERVER_INFO, {
      instructions: INSTRUCTIONS,
      maxToolInputElements: 10_000,
      cacheHints: mcpCacheHints({ ttlMs: 3_600_000 }),
    });
    // site-runtime's registerTools: only the tools the grant can call are listed (T7), each with the server's icon
    // (T9), the 403 step-up before a tool runs, and invokeTool, which still checks the scope (for a caller with no OAuth
    // grant behind it), logs the call and hands the handler the request's abort signal (P11).
    registerTools(server as unknown as Parameters<typeof registerTools>[0], TOOLS, { env, server: SERVER, caller, icons: SERVER_INFO.icons });
    return server;
  };
}

/** Routes one request to the era that can answer it. */
export async function handleMcp(
  request: Request,
  env: ToolEnv,
  ctx: ExecutionContext,
  caller: Caller | undefined,
): Promise<Response> {
  return routeMcpEra(request, env, ctx, {
    factory: buildServer(env, caller),
    options: { route: MCP_ROUTE },
    createMcpHandler,
    isLegacyRequest,
  });
}
