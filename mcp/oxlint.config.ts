import { defineConfig } from "oxlint";
import { base, node, ignorePatterns } from "@dustinedwards/devkit/oxlint";

// The admin MCP Worker is its own package (own lockfile, own CI job in ci-mcp.yml), so it carries its own config.
export default defineConfig({
  extends: [base],
  ignorePatterns,
  overrides: [{ files: ["scripts/**", "bin/**", "test/**"], ...node }],
});
