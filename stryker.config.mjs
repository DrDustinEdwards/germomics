// StrykerJS mutation baseline (job_f5acaeb4e003). Measurement only: not a gate, not in CI,
// not a dependency. Run in chunks so an interrupted run loses at most one chunk.
//
//   npm i --no-save @stryker-mutator/core@9.6.1 @stryker-mutator/vitest-runner@9.6.1
//   for c in db carrel content rest; do STRYKER_CHUNK=$c npx stryker run; done
//   npm run report:mutation
//
// Each chunk writes reports/mutation/<chunk>.json and its own incremental file.
import { chunkedStryker } from "@dustinedwards/devkit/stryker";

export default chunkedStryker({
  all: ["app/lib/**/*.ts", "app/db/**/*.ts", "workers/**/*.ts"],
  chunks: {
    db: ["app/db/**/*.ts"],
    carrel: ["app/lib/carrel/**/*.ts", "workers/**/*.ts"],
    content: [
      "app/lib/posts*.ts",
      "app/lib/content*.ts",
      "app/lib/rss.server.ts",
      "app/lib/render.server.ts",
      "app/lib/seo.ts",
      "app/lib/discovery.server.ts",
      "app/lib/vtt.ts",
    ],
  },
});
