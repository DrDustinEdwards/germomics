/**
 * The no-second-path guarantees, read from the files themselves:
 * - the Worker's bindings are exactly the allowlist (no D1, no site bucket, no
 *   binding that reaches Germomics' data; SITE is the only service binding),
 * - nothing in src/ imports the site's app, so the operator API is the only way in.
 *
 * The door (audience, administrator, scope list, rate limit) is site-runtime's adminMcpWorker, tested there.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";


const config = JSON.parse(
  readFileSync(new URL("../wrangler.jsonc.example", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, ""),
);

describe("bindings", () => {
  test("are exactly the allowlist", () => {
    const keys = Object.keys(config).filter((k) =>
      [
        "d1_databases",
        "r2_buckets",
        "kv_namespaces",
        "services",
        "durable_objects",
        "queues",
        "ai",
        "vectorize",
        "hyperdrive",
        "analytics_engine_datasets",
        "secrets_store_secrets",
      ].includes(k),
    );
    assert.deepEqual(keys.sort(), ["durable_objects", "kv_namespaces", "r2_buckets", "services"]);
    assert.deepEqual(config.services, [{ binding: "SITE", service: "germomics" }]);
    // The one bucket is this server's own copy of its tool-call log (L6), never one of Germomics's.
    assert.deepEqual(config.r2_buckets, [{ binding: "AUDIT_BUCKET", bucket_name: "germomics-admin-mcp-tool-calls" }]);
    assert.deepEqual(
      config.kv_namespaces.map((k: { binding: string }) => k.binding),
      ["OAUTH_KV"],
    );
    assert.deepEqual(
      config.durable_objects.bindings.map((b: { name: string }) => b.name).sort(),
      ["MCP_RATE_LIMIT", "TOOL_CALL_LOG"],
    );
  });
});

describe("imports", () => {
  test("src/ reaches nothing outside mcp/: no @foxing package, no ../../ path", () => {
    const dir = new URL("../src/", import.meta.url);
    const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
    assert.ok(files.length >= 5, `read ${files.length} source files`);
    let read = 0;
    for (const file of files) {
      const source = readFileSync(new URL(file, dir), "utf8");
      // from "x", a bare import "x", and a dynamic import("x").
      const specifiers = [
        ...source.matchAll(/(?:\bfrom\s+|\bimport\s*\(?\s*)["']([^"']+)["']/g),
      ].map((m) => m[1]);
      read += specifiers.length;
      for (const spec of specifiers) {
        assert.ok(!spec.startsWith("@foxing/"), `${file} imports ${spec}`);
        assert.ok(!spec.startsWith("../"), `${file} imports ${spec}`);
      }
    }
    // Pair the check with what it read, so "no violations" cannot mean "nothing read".
    assert.ok(read >= 15, `read only ${read} import specifiers`);
  });
});
