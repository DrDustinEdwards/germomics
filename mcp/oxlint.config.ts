import { defineConfig } from "oxlint";
import { base, node } from "@dustinedwards/devkit/oxlint";

// The admin MCP Worker is its own package (own lockfile, own CI job in ci-mcp.yml), so it carries its own config.
export default defineConfig({
  extends: [base],
  // Oxlint 1.92 does not carry ignorePatterns through extends: devkit's list, until devkit 0.24.0 exports it.
  ignorePatterns: ["build/", "dist/", ".react-router/", ".wrangler/", "worker-configuration.d.ts", "**/*.gen.ts"],
  rules: {
    // off in devkit 0.24.0
    "typescript/no-non-null-assertion": "off",
  },
  overrides: [{ files: ["scripts/**", "bin/**", "test/**"], ...node }],
});
