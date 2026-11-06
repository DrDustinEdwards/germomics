import { defineConfig } from "oxfmt";
import { format } from "@dustinedwards/devkit/oxfmt";

export default defineConfig({
  ...format,
  ignorePatterns: [
    ...(format.ignorePatterns ?? []),
    // The deploy config stays as committed (CLAUDE.md: wrangler.jsonc is never part of a change to commit by hand).
    "wrangler.jsonc",
    // Written by `npm run report:mutation` (devkit-mutation-report --json), byte for byte.
    "docs/research/kill-matrix.json",
    // The hand-written build plan: a single-file HTML spec with its own inline styles.
    "docs/germomics_build_plan.html",
  ],
});
