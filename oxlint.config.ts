import { defineConfig } from "oxlint";
import { base, react, node } from "@dustinedwards/devkit/oxlint";

export default defineConfig({
  extends: [base, react],
  // Oxlint 1.92 does not carry ignorePatterns through extends: devkit's list, until devkit 0.24.0 exports it. mcp/ is
  // its own package with its own lockfile and oxlint.config.ts, linted by its own job (ci-mcp.yml).
  ignorePatterns: ["build/", "dist/", ".react-router/", ".wrangler/", "worker-configuration.d.ts", "**/*.gen.ts", "mcp/"],
  rules: {
    // off in devkit 0.24.0
    "typescript/no-non-null-assertion": "off",
  },
  overrides: [
    { files: ["scripts/**", "bin/**", "test/**"], ...node },
    {
      files: ["**/*.{jsx,tsx}"],
      plugins: react.plugins,
      rules: {
        // off in devkit 0.24.0
        "react/only-export-components": "off",
        // off in devkit 0.24.0
        "jsx-a11y/prefer-tag-over-role": "off",
        // off in devkit 0.24.0
        "jsx-a11y/control-has-associated-label": "off",
        // off in devkit 0.24.0
        "jsx-a11y/media-has-caption": "off",
      },
    },
  ],
});
