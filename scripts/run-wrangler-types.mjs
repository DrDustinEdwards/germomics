// postinstall: run `wrangler types` without a terminal on stdin.
//
// Since wrangler 4.135.0, `wrangler types` on a terminal asks whether to update Cloudflare
// skills. npm hides script output, so the question is invisible and `npm install` waits
// forever. There is no switch for it; wrangler skips the prompt only in CI or when stdin or
// stdout is not a terminal. Ignoring stdin here makes it non-interactive everywhere.
// Same fix as Carrel (DrDustinEdwards/carrel#18). WRANGLER_BIN overrides the entry point so
// scripts/check-postinstall.mjs can run this against a stub.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// wrangler's "exports" hides bin/, so find it from package.json's bin field.
function wranglerEntry() {
  const pkgPath = createRequire(import.meta.url).resolve("wrangler/package.json");
  const { bin } = createRequire(import.meta.url)(pkgPath);
  return join(dirname(pkgPath), typeof bin === "string" ? bin : bin.wrangler);
}

const entry = process.env.WRANGLER_BIN ?? wranglerEntry();

const result = spawnSync(process.execPath, [entry, "types"], {
  stdio: ["ignore", "inherit", "inherit"],
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status ?? 1);
