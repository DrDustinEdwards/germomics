/**
 * The MCP request layer end to end: JSON-RPC into handleMcp, through the real
 * server and tool registration, out to the fake germomics Worker, and back. Driven
 * at the 2025-11-25 era, the one measured clients open at today.
 */
import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

import { toolListHash, toolListProblems } from "@dustinedwards/site-runtime/mcp-server";

import type { Caller } from "../src/auth.ts";
import { handleMcp } from "../src/mcp-handler.ts";
import { TOOLS, type ToolEnv } from "../src/tools.ts";
import {
  READER,
  TOKEN,
  WRITER,
  fakeLog,
  fakeSite,
  freshEnv,
  type FakeLog,
  type FakeSite,
} from "./fakes.ts";

const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
const ERA = "2025-11-25";

let site: FakeSite;
let log: FakeLog;
let env: ToolEnv;
let nextId = 1;

beforeEach(() => {
  site = fakeSite();
  log = fakeLog();
  env = freshEnv(site, log);
});

async function rpc(
  method: string,
  params: Record<string, unknown>,
  caller: Caller | null = WRITER,
) {
  const response = await handleMcp(
    new Request("https://admin-mcp.test/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "mcp-protocol-version": ERA,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
    }),
    env,
    ctx,
    caller ?? undefined,
  );
  const text = await response.text();
  const data = text.split("\n").find((line) => line.startsWith("data: "));
  return JSON.parse(data ? data.slice(6) : text);
}

describe("handleMcp", () => {
  test("initialize names the server and carries the instructions", async () => {
    const message = await rpc("initialize", {
      protocolVersion: ERA,
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    assert.equal(message.result.serverInfo.name, "germomics-admin-mcp");
    assert.match(message.result.instructions, /Carrel owns all writing/);
    assert.equal(site.calls.length, 0);
  });

  test("tools/list offers the germomics_ tools with all four annotations, and passes the shared list checks", async () => {
    const message = await rpc("tools/list", {});
    const listed = message.result.tools as Array<{
      name: string;
      annotations: Record<string, unknown>;
    }>;
    assert.deepEqual(
      listed.map((t) => t.name),
      TOOLS.map((t) => t.name),
    );
    for (const t of listed) {
      assert.match(t.name, /^germomics_[a-z_]+$/);
      for (const hint of ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"]) {
        assert.equal(typeof t.annotations[hint], "boolean", `${t.name} ${hint}`);
      }
    }
    assert.deepEqual(toolListProblems(message.result.tools), []);
    assert.match(await toolListHash(message.result.tools), /^[a-f0-9]+$/);
  });

  test("tools/call becomes one operator API request, logged before and after, and returns its data", async () => {
    const files = [{ name: "game-assets", complete: true, objects: 3, copied: 3 }];
    site.reply({ body: { ok: true, data: { files } } });
    const message = await rpc("tools/call", { name: "germomics_backup_media", arguments: {} });
    assert.equal(site.calls.length, 1);
    const sent = site.calls[0];
    assert.equal(sent.method, "POST");
    assert.equal(sent.url.origin, "https://germomics.com");
    assert.equal(sent.url.pathname, "/api/operator");
    assert.equal(sent.headers.get("authorization"), `Bearer ${TOKEN}`);
    assert.deepEqual(sent.body, { tool: "backup_media", args: {} });
    assert.deepEqual(message.result.structuredContent, { files });
    assert.deepEqual(
      log.rows.map((r) => r.phase),
      ["started", "finished"],
    );
    assert.ok(!JSON.stringify(message).includes(TOKEN));
  });

  test("a read grant reads the backup state through the same leg", async () => {
    site.reply({
      body: { ok: true, data: { files: { gameAssets: { last_ok: "2026-11-06T03:20:00Z" } } } },
    });
    const message = await rpc(
      "tools/call",
      { name: "germomics_check_backup", arguments: {} },
      READER,
    );
    assert.deepEqual(site.calls[0].body, { tool: "backup_status", args: {} });
    assert.equal(message.result.structuredContent.files.gameAssets.last_ok, "2026-11-06T03:20:00Z");
  });

  test("the API's refusal comes back verbatim as a tool error", async () => {
    site.reply({
      status: 500,
      body: { ok: false, error: "files backup failed: game-assets: boom" },
    });
    const message = await rpc("tools/call", { name: "germomics_backup_media", arguments: {} });
    assert.equal(message.result.isError, true);
    assert.match(message.result.content[0].text, /files backup failed: game-assets: boom/);
  });

  test("PLANT 12.3: a read-only grant is not listed the write tool, is refused it, and sends nothing (T7)", async () => {
    const listed = (await rpc("tools/list", {}, READER)).result.tools.map(
      (t: { name: string }) => t.name,
    );
    assert.deepEqual(listed, ["germomics_check_backup"]);
    const message = await rpc(
      "tools/call",
      { name: "germomics_backup_media", arguments: {} },
      READER,
    );
    assert.ok(
      message.error !== undefined || message.result?.isError === true,
      JSON.stringify(message),
    );
    assert.equal(site.calls.length, 0);
  });

  test("a schema violation fails before any request", async () => {
    const message = await rpc("tools/call", {
      name: "germomics_backup_media",
      arguments: { extra: 1 },
    });
    assert.equal(site.calls.length, 0);
    assert.ok(
      message.error !== undefined || message.result?.isError === true,
      JSON.stringify(message),
    );
  });

  test("a request with no caller runs no tool", async () => {
    const message = await rpc(
      "tools/call",
      { name: "germomics_backup_media", arguments: {} },
      null,
    );
    assert.ok(
      message.error !== undefined || message.result?.isError === true,
      JSON.stringify(message),
    );
    assert.equal(site.calls.length, 0);
  });
});
