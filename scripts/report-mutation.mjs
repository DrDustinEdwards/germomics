#!/usr/bin/env node
// Summarise a StrykerJS run (job_f5acaeb4e003). Measurement only: reads every
// reports/mutation/<chunk>.json (see stryker.config.mjs), merges them, prints the score, the
// per-file table and the removal candidates. It deletes nothing and decides nothing.
//
// Candidates: zero-kill (kills no mutant) and covered (every mutant it kills is also killed by
// another test). Per test, not joint: two tests that only cover each other both show up.
// Protected (never candidates): security, auth, access, sanitizing (XSS boundary), session,
// admin, backup/restore, and tests written for a fixed bug. A name heuristic that errs toward keeping.
//
// --json writes docs/research/kill-matrix.json; --table prints the per-file markdown table.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const DIR = process.env.MUTATION_DIR ?? resolve(ROOT, "reports/mutation");
const reports = readdirSync(DIR)
  .filter((n) => n.endsWith(".json") && n !== "kill-matrix.json" && !n.startsWith("incremental"))
  .map((n) => JSON.parse(readFileSync(resolve(DIR, n), "utf8")));
if (reports.length === 0) {
  console.error("report-mutation: no mutation JSON found. Run Stryker first.");
  process.exit(1);
}

const PROTECTED =
  /auth|access|security|sanitiz|xss|csp|session|admin|login|jwt|backup|restore|token|secret|permission|regression|fix|bug/i;

const tests = new Map();
const counts = {};
const perFile = new Map();
const killers = new Map();
for (const report of reports) {
  const keyOf = new Map();
  for (const [file, entry] of Object.entries(report.testFiles ?? {})) {
    for (const test of entry.tests ?? []) {
      const key = `${file}::${test.name}`;
      keyOf.set(test.id, key);
      if (!tests.has(key)) tests.set(key, { file, name: test.name, kills: new Set() });
    }
  }
  for (const [file, entry] of Object.entries(report.files ?? {})) {
    const f = perFile.get(file) ?? {};
    perFile.set(file, f);
    for (const mutant of entry.mutants ?? []) {
      counts[mutant.status] = (counts[mutant.status] ?? 0) + 1;
      f[mutant.status] = (f[mutant.status] ?? 0) + 1;
      const key = `${file}#${mutant.id}`;
      const by = mutant.killedBy ?? [];
      killers.set(key, by.length);
      for (const id of by) tests.get(keyOf.get(id))?.kills.add(key);
    }
  }
}

const killed = (c) => (c.Killed ?? 0) + (c.Timeout ?? 0);
const valid = (c) => killed(c) + (c.Survived ?? 0) + (c.NoCoverage ?? 0);
const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(2)}%` : "n/a");

const rows = [];
for (const t of tests.values()) {
  let unique = 0;
  for (const key of t.kills) if (killers.get(key) === 1) unique += 1;
  const isProtected = PROTECTED.test(t.file) || PROTECTED.test(t.name);
  const kind = t.kills.size === 0 ? "zero-kill" : unique === 0 ? "covered" : "";
  rows.push({ file: t.file, name: t.name, kills: t.kills.size, unique, kind, protected: isProtected });
}
const zero = rows.filter((r) => r.kind === "zero-kill");
const covered = rows.filter((r) => r.kind === "covered");
console.log(`Reports merged: ${reports.length}`);
console.log("Mutant status counts:", counts);
console.log(`Mutation score: ${pct(killed(counts), valid(counts))} (${killed(counts)} of ${valid(counts)})`);
console.log(`Score over covered code: ${pct(killed(counts), killed(counts) + (counts.Survived ?? 0))}`);
console.log(`Tests in the kill matrix: ${rows.length}`);
console.log(`Zero-kill: ${zero.length} (${zero.filter((r) => r.protected).length} protected)`);
console.log(`Covered by others: ${covered.length} (${covered.filter((r) => r.protected).length} protected)`);
console.log(`Unprotected candidates: ${zero.filter((r) => !r.protected).length} zero-kill, ${covered.filter((r) => !r.protected).length} covered`);

if (process.argv.includes("--table")) {
  console.log("\n| File | Mutants | Killed | Survived | No coverage | Score |\n|---|---|---|---|---|---|");
  for (const [file, c] of [...perFile].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`| ${file} | ${valid(c)} | ${killed(c)} | ${c.Survived ?? 0} | ${c.NoCoverage ?? 0} | ${pct(killed(c), valid(c))} |`);
  }
}
if (process.argv.includes("--json")) {
  const out = resolve(ROOT, "docs/research");
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, "kill-matrix.json"), JSON.stringify(rows, null, 2));
  console.log("Wrote docs/research/kill-matrix.json");
}
