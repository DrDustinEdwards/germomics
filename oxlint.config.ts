import { defineConfig } from "oxlint";
import { base, react, node } from "@dustinedwards/devkit/oxlint";

export default defineConfig({
  extends: [base, react],
  // mcp/ is its own package with its own lockfile and oxlint.config.ts, linted by its own job (ci-mcp.yml).
  ignorePatterns: ["mcp/"],
  overrides: [{ files: ["scripts/**", "bin/**", "test/**"], ...node }],
});
