// StrykerJS mutation baseline (job_f5acaeb4e003). Measurement only: not a gate, not in CI,
// not a dependency. Run in chunks so an interrupted run loses at most one chunk.
//
//   npm i --no-save @stryker-mutator/core@9.6.1 @stryker-mutator/vitest-runner@9.6.1
//   for c in db carrel content rest; do STRYKER_CHUNK=$c npx stryker run; done
//   node scripts/report-mutation.mjs --json
//
// Each chunk writes reports/mutation/<chunk>.json and its own incremental file.
import process from "node:process";

const ALL = ["app/lib/**/*.ts", "app/db/**/*.ts", "workers/**/*.ts"];
const CHUNKS = {
  db: ["app/db/**/*.ts"],
  carrel: ["app/lib/carrel/**/*.ts", "workers/**/*.ts"],
  content: [
    "app/lib/posts*.ts",
    "app/lib/content*.ts",
    "app/lib/rss.server.ts",
    "app/lib/sanitize.server.ts",
    "app/lib/seo.ts",
    "app/lib/discovery.server.ts",
    "app/lib/vtt.ts",
  ],
};
CHUNKS.rest = [...ALL, ...Object.values(CHUNKS).flat().map((glob) => `!${glob}`)];

const chunk = process.env.STRYKER_CHUNK;
if (chunk && !CHUNKS[chunk]) {
  throw new Error(`Unknown STRYKER_CHUNK "${chunk}"; one of ${Object.keys(CHUNKS).join(", ")}`);
}
const name = chunk ?? "mutation";

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: "vitest",
  coverageAnalysis: "perTest",
  disableBail: true,
  incremental: true,
  incrementalFile: `reports/stryker-incremental-${name}.json`,
  mutate: [...(chunk ? CHUNKS[chunk] : ALL), "!**/*.d.ts"],
  ignoreStatic: true,
  reporters: ["json", "clear-text", "progress"],
  jsonReporter: { fileName: `reports/mutation/${name}.json` },
  concurrency: 4,
  timeoutMS: 30000,
  tempDirName: ".stryker-tmp",
};
