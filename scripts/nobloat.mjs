// No-bloat reports (capsid/decisions.md "no bloat, as a standing plan", phase 0).
//
// WARN-ONLY, AND THAT IS THE RULING. Every subcommand reports and exits 0: these numbers are
// defaults, not laws, and they never block a merge. A number above the baseline becomes a
// `::warning::` annotation in Actions and a line in the job summary, nothing more.
//
// Detection comes from the tools (Knip, jscpd). This script only reads their output,
// compares it with docs/no-bloat/baseline.json and prints the result.
//
//   node scripts/nobloat.mjs knip       reads .nobloat/knip.json   (npm run nobloat:knip)
//   node scripts/nobloat.mjs jscpd      reads .nobloat/jscpd/       (npm run nobloat:jscpd)
//   node scripts/nobloat.mjs baseline   writes docs/no-bloat/baseline.json from both,
//                                       plus lines of code and dependency counts
import { execSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASELINE_PATH = path.join(ROOT, "docs/no-bloat/baseline.json");
const KNIP_REPORT = path.join(ROOT, ".nobloat/knip.json");
const JSCPD_REPORT = path.join(ROOT, ".nobloat/jscpd/jscpd-report.json");

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const baseline = existsSync(BASELINE_PATH) ? readJson(BASELINE_PATH) : null;
const signed = (n) => (n > 0 ? `+${n}` : String(n));

let summary = "";
const out = (line = "") => {
  summary += `${line}\n`;
};
const warn = (message) => {
  // GitHub turns this into an annotation on the run; locally it is just a line.
  console.log(`::warning title=no-bloat::${message}`);
  out(`> Warning: ${message}`);
};
const flush = () => {
  process.stdout.write(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
};

// ---------- Knip ----------

function knipCounts() {
  if (!existsSync(KNIP_REPORT)) return null;
  const { issues } = readJson(KNIP_REPORT);
  const counts = {};
  const items = {};
  for (const issue of issues) {
    for (const [type, list] of Object.entries(issue)) {
      if (!Array.isArray(list) || list.length === 0) continue;
      counts[type] = (counts[type] ?? 0) + list.length;
      for (const entry of list) (items[type] ??= []).push(`${issue.file}: ${entry.name ?? ""}`.replace(/: $/, ""));
    }
  }
  return { counts, items };
}

function knip() {
  const result = knipCounts();
  out("## Knip (unused files, exports and dependencies)");
  out();
  if (!result) {
    warn("no Knip report at .nobloat/knip.json; run `npm run nobloat:knip`");
    return;
  }
  const base = baseline?.knip?.counts ?? {};
  const types = [...new Set([...Object.keys(result.counts), ...Object.keys(base)])].sort();
  out("| Issue type | Now | Baseline | Change |");
  out("|---|--:|--:|--:|");
  for (const type of types) {
    const now = result.counts[type] ?? 0;
    const was = base[type] ?? 0;
    out(`| ${type} | ${now} | ${was} | ${signed(now - was)} |`);
    if (now > was) warn(`Knip ${type}: ${now}, baseline ${was}`);
  }
  if (types.length === 0) out("| (none) | 0 | 0 | 0 |");
  out();
  for (const type of Object.keys(result.items).sort()) {
    out(`<details><summary>${type} (${result.items[type].length})</summary>\n`);
    for (const item of result.items[type]) out(`- \`${item}\``);
    out("\n</details>\n");
  }
}

// ---------- jscpd ----------

function jscpdStats() {
  if (!existsSync(JSCPD_REPORT)) return null;
  const report = readJson(JSCPD_REPORT);
  const t = report.statistics.total;
  return {
    sources: t.sources,
    lines: t.lines,
    clones: t.clones,
    duplicatedLines: t.duplicatedLines,
    percentage: Number(t.percentage.toFixed(2)),
    percentageTokens: Number(t.percentageTokens.toFixed(2)),
    duplicates: report.duplicates,
  };
}

function jscpd() {
  const stats = jscpdStats();
  out("## jscpd (duplicated blocks)");
  out();
  if (!stats) {
    warn("no jscpd report at .nobloat/jscpd/; run `npm run nobloat:jscpd`");
    return;
  }
  const base = baseline?.jscpd;
  out("| Measure | Now | Baseline |");
  out("|---|--:|--:|");
  out(`| Files analysed | ${stats.sources} | ${base?.sources ?? "n/a"} |`);
  out(`| Clones | ${stats.clones} | ${base?.clones ?? "n/a"} |`);
  out(`| Duplicated lines | ${stats.duplicatedLines} of ${stats.lines} | ${base ? `${base.duplicatedLines} of ${base.lines}` : "n/a"} |`);
  out(`| Duplication (lines) | ${stats.percentage}% | ${base ? `${base.percentage}%` : "n/a"} |`);
  out(`| Duplication (tokens) | ${stats.percentageTokens}% | ${base ? `${base.percentageTokens}%` : "n/a"} |`);
  out();
  if (base && stats.percentage > base.percentage) {
    warn(`duplication ${stats.percentage}% of lines, baseline ${base.percentage}%`);
  }
  if (stats.duplicates.length) {
    out(`<details><summary>Clones (${stats.duplicates.length})</summary>\n`);
    for (const d of stats.duplicates) {
      out(`- ${d.lines} lines: \`${d.firstFile.name}:${d.firstFile.start}\` and \`${d.secondFile.name}:${d.secondFile.start}\``);
    }
    out("\n</details>\n");
  }
}

// ---------- Baseline ----------

const LANGUAGES = {
  ".ts": "TypeScript",
  ".tsx": "TSX",
  ".mjs": "JavaScript",
  ".js": "JavaScript",
  ".css": "CSS",
  ".sql": "SQL",
};

// Non-blank lines of tracked files, by extension. Generated and vendored trees are untracked
// (.gitignore), so `git ls-files` is the source list; docs, research and public are excluded.
function linesOfCode() {
  const files = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
  const loc = {};
  for (const file of files) {
    if (/^(docs|research|public|\.claude)\//.test(file)) continue;
    if (file === "package-lock.json") continue;
    const language = LANGUAGES[path.extname(file)];
    if (!language) continue;
    const lines = readFileSync(path.join(ROOT, file), "utf8").split("\n").filter((l) => l.trim()).length;
    loc[language] = (loc[language] ?? 0) + lines;
  }
  return loc;
}

function dependencyCounts() {
  const pkg = readJson(path.join(ROOT, "package.json"));
  const lock = readJson(path.join(ROOT, "package-lock.json"));
  const installed = Object.entries(lock.packages).filter(([key]) => key.startsWith("node_modules/") || key.includes("/node_modules/"));
  return {
    dependencies: Object.keys(pkg.dependencies ?? {}).length,
    devDependencies: Object.keys(pkg.devDependencies ?? {}).length,
    lockfilePackages: installed.length,
    lockfileProductionPackages: installed.filter(([, meta]) => !meta.dev).length,
  };
}

function writeBaseline() {
  const k = knipCounts();
  const j = jscpdStats();
  if (!k || !j) {
    console.error("baseline needs both reports: npm run nobloat:knip and nobloat:jscpd first");
    process.exit(1);
  }
  const { duplicates, ...jscpdTotals } = j;
  const result = {
    commit: execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim(),
    measuredAt: new Date().toISOString().slice(0, 10),
    knip: { counts: k.counts },
    jscpd: jscpdTotals,
    linesOfCode: linesOfCode(),
    dependencies: dependencyCounts(),
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`wrote ${path.relative(ROOT, BASELINE_PATH)} at ${result.commit}`);
}

const command = process.argv[2];
if (command === "knip") knip();
else if (command === "jscpd") jscpd();
else if (command === "baseline") writeBaseline();
else {
  console.error("usage: node scripts/nobloat.mjs knip|jscpd|baseline");
  process.exit(1);
}
flush();
