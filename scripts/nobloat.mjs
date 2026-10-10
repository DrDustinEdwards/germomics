// No-bloat reports (capsid/decisions.md "no bloat, as a standing plan", phase 0).
//
// WARN-ONLY, AND THAT IS THE RULING. Every subcommand reports and exits 0: these numbers are
// defaults, not laws, and they never block a merge. A number above the baseline becomes a
// `::warning::` annotation in Actions and a line in the job summary, nothing more.
//
// Detection comes from the tools (Knip, jscpd, the React Router client manifest). This script
// only reads their output, compares it with docs/no-bloat/baseline.json and prints the result.
//
//   node scripts/nobloat.mjs knip       reads .nobloat/knip.json   (npm run nobloat:knip)
//   node scripts/nobloat.mjs jscpd      reads .nobloat/jscpd/       (npm run nobloat:jscpd)
//   node scripts/nobloat.mjs weight     reads build/client          (after npm run build)
//   node scripts/nobloat.mjs baseline   writes docs/no-bloat/baseline.json from all three,
//                                       plus lines of code and dependency counts
import { execSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = path.resolve(import.meta.dirname, "..");
const BASELINE_PATH = path.join(ROOT, "docs/no-bloat/baseline.json");
const KNIP_REPORT = path.join(ROOT, ".nobloat/knip.json");
const JSCPD_REPORT = path.join(ROOT, ".nobloat/jscpd/jscpd-report.json");
const CLIENT_DIR = path.join(ROOT, "build/client");
const SERVER_DIR = path.join(ROOT, "build/server");

// A route's weight may move by this much (gzip bytes) before it warns: hashing and minifier
// noise move a few bytes on unrelated changes.
const WEIGHT_TOLERANCE_BYTES = 512;

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const baseline = existsSync(BASELINE_PATH) ? readJson(BASELINE_PATH) : null;
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const signed = (n, fmt = String) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `-${fmt(-n)}` : "0");

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

// ---------- Page weight ----------

// React Router writes the client route manifest as a script. Each route lists its own module,
// the chunks it imports and its CSS; a page loads the entry plus every route from root down
// to the leaf, so a route's weight is the union of those, counted once each.
function readManifest() {
  const assets = path.join(CLIENT_DIR, "assets");
  if (!existsSync(assets)) return null;
  const file = readdirSync(assets).find((f) => /^manifest-[\w-]+\.js$/.test(f));
  if (!file) return null;
  const source = readFileSync(path.join(assets, file), "utf8");
  return JSON.parse(source.replace(/^window\.__reactRouterManifest=/, "").replace(/;\s*$/, ""));
}

const gzipCache = new Map();
function gzipBytes(url) {
  if (!gzipCache.has(url)) {
    const body = readFileSync(path.join(CLIENT_DIR, url));
    gzipCache.set(url, { raw: body.length, gzip: gzipSync(body, { level: 9 }).length });
  }
  return gzipCache.get(url);
}

function sumAssets(urls) {
  let raw = 0;
  let gzip = 0;
  for (const url of urls) {
    const size = gzipBytes(url);
    raw += size.raw;
    gzip += size.gzip;
  }
  return { raw, gzip };
}

function dirBytes(dir) {
  let raw = 0;
  let gzip = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !/\.(m?js|css)$/.test(entry.name)) continue;
    const body = readFileSync(path.join(entry.parentPath, entry.name));
    raw += body.length;
    gzip += gzipSync(body, { level: 9 }).length;
  }
  return { raw, gzip };
}

function pageWeights() {
  const manifest = readManifest();
  if (!manifest) return null;
  const { entry, routes } = manifest;
  const routeUrl = (id) => {
    const parts = [];
    for (let r = routes[id]; r; r = routes[r.parentId]) if (r.path) parts.unshift(r.path);
    return `/${parts.join("/")}`;
  };
  const pages = {};
  const initial = new Set();
  for (const [id, route] of Object.entries(routes)) {
    // Resource routes (feeds, robots.txt, health) render no page and load no client code.
    if (!route.hasDefaultExport || id === "root") continue;
    const js = new Set([entry.module, ...entry.imports]);
    const css = new Set();
    for (let r = route; r; r = routes[r.parentId]) {
      js.add(r.module);
      for (const url of r.imports ?? []) js.add(url);
      for (const url of r.css ?? []) css.add(url);
    }
    for (const url of [...js, ...css]) initial.add(url);
    const jsSize = sumAssets(js);
    const cssSize = sumAssets(css);
    pages[routeUrl(id)] = { jsGzip: jsSize.gzip, cssGzip: cssSize.gzip, jsRaw: jsSize.raw, cssRaw: cssSize.raw };
  }
  // Chunks no page loads up front: the lazy ones (maps, charts, Phaser, the editor).
  const lazy = {};
  for (const file of readdirSync(path.join(CLIENT_DIR, "assets"))) {
    const url = `/assets/${file}`;
    if (!/\.(js|css)$/.test(file) || file.startsWith("manifest-") || initial.has(url)) continue;
    const size = gzipBytes(url);
    if (size.raw >= 1024) lazy[file.replace(/-[\w-]{8}\.(js|css)$/, ".$1")] = size.gzip;
  }
  const shared = sumAssets(new Set([entry.module, ...entry.imports, routes.root.module, ...routes.root.imports]));
  const sortedPages = Object.fromEntries(Object.entries(pages).sort(([a], [b]) => a.localeCompare(b)));
  const sortedLazy = Object.fromEntries(Object.entries(lazy).sort(([, a], [, b]) => b - a));
  return {
    sharedJsGzip: shared.gzip,
    pages: sortedPages,
    lazy: sortedLazy,
    server: existsSync(SERVER_DIR) ? dirBytes(SERVER_DIR) : null,
  };
}

function weight() {
  const weights = pageWeights();
  out("## Page weight (gzip -9, per route, JS and CSS loaded on first view)");
  out();
  if (!weights) {
    warn("no client manifest in build/client/assets; run `npm run build` first");
    return;
  }
  const base = baseline?.weight;
  out(`Shared JS (entry and root, on every page): ${kb(weights.sharedJsGzip)}` +
    (base ? ` (baseline ${kb(base.sharedJsGzip)})` : ""));
  if (weights.server) {
    out(`Worker bundle (build/server JS and CSS): ${kb(weights.server.raw)} raw, ${kb(weights.server.gzip)} gzip` +
      (base?.server ? ` (baseline ${kb(base.server.raw)} raw, ${kb(base.server.gzip)} gzip)` : ""));
  }
  out();
  out("| Route | JS | CSS | Total | Change |");
  out("|---|--:|--:|--:|--:|");
  for (const [url, page] of Object.entries(weights.pages)) {
    const total = page.jsGzip + page.cssGzip;
    const was = base?.pages?.[url];
    const wasTotal = was ? was.jsGzip + was.cssGzip : null;
    const change = wasTotal === null ? "new" : signed(total - wasTotal, kb);
    out(`| \`${url}\` | ${kb(page.jsGzip)} | ${kb(page.cssGzip)} | ${kb(total)} | ${change} |`);
    if (wasTotal !== null && total - wasTotal > WEIGHT_TOLERANCE_BYTES) {
      warn(`${url} first-view weight ${kb(total)}, baseline ${kb(wasTotal)}`);
    }
  }
  out();
  if (base?.server && weights.server && weights.server.gzip - base.server.gzip > WEIGHT_TOLERANCE_BYTES) {
    warn(`worker bundle ${kb(weights.server.gzip)} gzip, baseline ${kb(base.server.gzip)}`);
  }
  out(`<details><summary>Lazy chunks (not loaded on first view, 1 KB raw and over)</summary>\n`);
  out("| Chunk | gzip |");
  out("|---|--:|");
  for (const [name, size] of Object.entries(weights.lazy)) out(`| \`${name}\` | ${kb(size)} |`);
  out("\n</details>\n");
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
    if (/^(docs|research|public|improve|\.claude)\//.test(file)) continue;
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
  const w = pageWeights();
  if (!k || !j || !w) {
    console.error("baseline needs all three reports: npm run nobloat:knip, nobloat:jscpd and build first");
    process.exit(1);
  }
  const { duplicates, ...jscpdTotals } = j;
  const result = {
    commit: execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim(),
    measuredAt: new Date().toISOString().slice(0, 10),
    knip: { counts: k.counts },
    jscpd: jscpdTotals,
    weight: w,
    linesOfCode: linesOfCode(),
    dependencies: dependencyCounts(),
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`wrote ${path.relative(ROOT, BASELINE_PATH)} at ${result.commit}`);
}

const command = process.argv[2];
if (command === "knip") knip();
else if (command === "jscpd") jscpd();
else if (command === "weight") weight();
else if (command === "baseline") writeBaseline();
else {
  console.error("usage: node scripts/nobloat.mjs knip|jscpd|weight|baseline");
  process.exit(1);
}
flush();
