// Proves the postinstall cannot wait on stdin (job_2564fa52065f).
// The stub below stands in for wrangler's skills prompt: it blocks until stdin yields data or
// ends. Run through run-wrangler-types.mjs (stdin ignored) it finishes; run with an open stdin
// pipe, as a terminal or npm would give it, it hangs. Both halves must hold, so the check is
// seen failing without the fix: `node scripts/check-postinstall.mjs --unfixed` must time out.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const unfixed = process.argv.includes("--unfixed");
const dir = mkdtempSync(join(tmpdir(), "postinstall-check-"));
const stub = join(dir, "wrangler-stub.mjs");
writeFileSync(
  stub,
  'process.stdin.once("data", () => process.exit(0));\nprocess.stdin.once("end", () => process.exit(0));\n',
);

const args = unfixed ? [stub] : [resolve("scripts/run-wrangler-types.mjs")];
// spawnSync would close a piped stdin; spawn leaves it open, as a terminal or npm does.
const child = spawn(process.execPath, args, {
  stdio: ["pipe", "inherit", "inherit"],
  env: { ...process.env, WRANGLER_BIN: stub },
});
const timer = setTimeout(() => {
  console.error("check:postinstall FAILED: timed out waiting on stdin");
  child.kill();
  process.exit(1);
}, 10_000);
child.on("exit", (code) => {
  clearTimeout(timer);
  if (code !== 0) {
    console.error(`check:postinstall FAILED: exit ${code}`);
    process.exit(1);
  }
  console.log("check:postinstall ok");
  process.exit(0);
});
