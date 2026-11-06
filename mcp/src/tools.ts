/**
 * The tools. Ruling mcp-2026-10-10 and capsid/research/design-mcp-servers.md section 5.
 *
 * WHOLE JOBS, NOT ENDPOINT MIRRORS (rule 4). NAMES (rule 5) are `germomics_{action}_{resource}`. ANNOTATIONS (rule 6)
 * are set honestly. ONLY TOOLS THE API OFFERS: this server adds no route of its own, so a tool is here only when
 * POST /api/operator on the site has it (app/routes/api.operator.ts). Germomics' writing is Carrel's, so there is no
 * post or page tool.
 *
 * EVERY CALL GOES THROUGH site-runtime's invokeTool (mcp-handler.ts), which checks the scope each tool declares (12.3)
 * and writes the append-only log before and after (12.4).
 */

import type { AuditEnv } from "@dustinedwards/site-runtime/audit-log";
import { logEvent } from "@dustinedwards/site-runtime/log";
import { z } from "zod";

import { ApiLegError, callOperator, type ApiEnv } from "./api-client";

export type ToolEnv = Partial<ApiEnv> & Partial<AuditEnv> & { ADMIN_EMAIL?: string };

/** The MCP content shape a tool returns. */
export type ToolOutput = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
};

const record = z.looseObject({});

/** A failure on this side, named so it cannot be mistaken for the API refusing something. The client gets only its kind (S4). */
function wrapperFailure(cause: unknown): ToolOutput {
  const kind = cause instanceof ApiLegError ? cause.kind : "unexpected";
  logEvent("tool_failure", { kind, error: cause instanceof Error ? cause.message : String(cause) }, { level: "error" });
  const message =
    cause instanceof ApiLegError
      ? `The MCP server could not complete its request to the Germomics operator API (${kind}). Nothing more is shown here; the detail is in the server's log.`
      : "The MCP server failed unexpectedly. Nothing more is shown here; the detail is in the server's log.";
  return { isError: true, content: [{ type: "text", text: message }] };
}

/** One operator call: the API's data is the result, its refusal the API's message verbatim. */
async function operate(env: ToolEnv, tool: string, signal?: AbortSignal, args: Record<string, unknown> = {}): Promise<ToolOutput> {
  try {
    const result = await callOperator(env, tool, args, { signal });
    if (!result.ok) {
      return {
        isError: true,
        content: [{ type: "text", text: result.error ?? "The Germomics operator API refused the request." }],
        structuredContent: { status: result.status, error: result.error ?? null },
      };
    }
    const data = (result.data ?? {}) as Record<string, unknown>;
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }], structuredContent: data };
  } catch (cause) {
    return wrapperFailure(cause);
  }
}

export interface ToolDefinition {
  name: string;
  scope: "read" | "write";
  config: {
    title: string;
    description: string;
    inputSchema: z.ZodType;
    outputSchema: z.ZodType;
    annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean };
  };
  handler: (env: ToolEnv, args: Record<string, unknown>, signal?: AbortSignal) => Promise<ToolOutput>;
}

export const TOOLS: ToolDefinition[] = [
  {
    name: "germomics_check_backup",
    scope: "read",
    config: {
      title: "Check the backups",
      description:
        "Reads the backup state now, uncached: the newest complete D1 dump's age and each files pass (audio, images, " +
        "game assets) with when it last completed, and a warning when any is past 26 hours. /health reports the same " +
        "fields but caches the read for an hour; this does not. Run germomics_backup_media to back up now.",
      inputSchema: z.strictObject({}),
      outputSchema: z.looseObject({ files: record }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    handler: (env, _args, signal) => operate(env, "backup_status", signal),
  },

  {
    name: "germomics_backup_media",
    scope: "write",
    config: {
      title: "Back up the files now",
      description:
        "Runs the nightly files backup now: one pass each over the episode audio, the images and the game assets into " +
        "the backups bucket (files/audio/, files/images/ and files/game-assets/), which Capsid copies to Amazon. It " +
        "copies new and changed files and drops a copy only 30 days after its file is gone; it never writes or " +
        "deletes in the audio, image or game-asset buckets. A pass stops at its write or time budget and the next " +
        "goes on from there. Reports each backup's counts and whether its pass completed. /health caches the backup " +
        "read for an hour, so its backup fields may take up to an hour to show this run.",
      inputSchema: z.strictObject({}),
      outputSchema: z.looseObject({ files: z.array(record) }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    handler: (env, _args, signal) => operate(env, "backup_media", signal),
  },

  {
    name: "germomics_delete_media",
    scope: "write",
    config: {
      title: "Delete library pictures",
      description:
        "Deletes pictures from the media library by key (1 to 25 a call), through the same delete Carrel runs. A picture a " +
        "post, an episode or the show still uses is refused and named, and a deleted file's last bytes are kept in history, so " +
        "Carrel can revert it. Answers which keys were deleted, refused (with the reason) or not found. List the keys in " +
        "Carrel's media library first (the Unattached filter shows pictures nothing uses).",
      inputSchema: z.strictObject({ keys: z.array(z.string().regex(/^[A-Za-z0-9._~/-]{1,200}$/)).min(1).max(25) }),
      outputSchema: z.looseObject({ deleted: z.array(z.string()), refused: z.array(record), missing: z.array(z.string()) }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    handler: (env, args, signal) => operate(env, "delete_media", signal, { keys: args.keys }),
  },
];
