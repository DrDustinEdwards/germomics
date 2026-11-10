/**
 * The look sheet: every figure in public/blog-diagrams/, rendered with the
 * site's own app.css, light and dark, at article width and phone width, and
 * stacked into one image per figure plus one contact sheet for all of them.
 *
 * A figure is only as good as it looks on the page, so this renders the real
 * fragment with the real stylesheet rather than a bare SVG with the tokens
 * pasted in: a class app.css does not define draws a solid black fill, and
 * only the real stylesheet shows that.
 *
 *   node scripts/figures/look.mjs [name ...]   (no names: every figure)
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const { chromium } = createRequire(import.meta.url)("playwright");

const ROOT = path.resolve(import.meta.dirname, "../..");
const FIGURES = path.join(ROOT, "public/blog-diagrams");
const OUT = process.env.FIGURE_LOOK_DIR || path.join(ROOT, ".figures");
const WIDTHS = [
  ["article", 760],
  ["phone", 390],
];
const THEMES = ["light", "dark"];

const css = fs.readFileSync(path.join(ROOT, "app/app.css"), "utf8");
const wanted = process.argv.slice(2);
const names = fs
  .readdirSync(FIGURES)
  .filter((f) => f.endsWith(".html"))
  .map((f) => f.replace(/\.html$/, ""))
  .filter((n) => wanted.length === 0 || wanted.includes(n))
  .sort();

if (names.length === 0) {
  console.error(wanted.length ? `No figure named ${wanted.join(", ")}.` : "No figures to render.");
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });

/**
 * ImageMagick, if it is here: the sheet is a convenience, not the point.
 * Version 7 is one `magick` with the tool as its first argument; version 6
 * is a separate binary per tool. Try both, and give up quietly on neither.
 */
function magick(tool, args) {
  for (const argv of [
    ["magick", tool, ...args],
    [tool, ...args],
  ]) {
    try {
      execFileSync(argv[0], argv.slice(1), { stdio: "pipe" });
      return true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return false;
}

const browser = await chromium.launch();
const shots = [];

for (const name of names) {
  const html = fs.readFileSync(path.join(FIGURES, `${name}.html`), "utf8");
  const row = [];
  for (const [label, width] of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 600 }, deviceScaleFactor: 2 });
    for (const theme of THEMES) {
      await page.setContent(
        `<!doctype html><html data-theme="${theme}"><style>${css}</style>` +
          `<body style="background:var(--bg);margin:0;padding:16px;font-family:system-ui">${html}</body></html>`,
      );
      const block = await page.$(".blog-diagram-block");
      if (!block) throw new Error(`${name}: no .blog-diagram-block in the fragment.`);
      const file = path.join(OUT, `${name}-${label}-${theme}.png`);
      await block.screenshot({ path: file });
      row.push(file);
    }
    await page.close();
  }
  const sheet = path.join(OUT, `${name}.png`);
  if (
    magick("montage", [
      ...row,
      "-tile",
      "2x2",
      "-geometry",
      "+8+8",
      "-background",
      "#808080",
      sheet,
    ])
  ) {
    shots.push(sheet);
    console.log(`${name}  ->  ${sheet}`);
  } else {
    console.log(`${name}  ->  ${row.join(" ")}`);
  }
}

await browser.close();

if (shots.length > 1) {
  const all = path.join(OUT, "look-sheet.png");
  if (
    magick("montage", [
      ...shots,
      "-tile",
      "2x",
      "-geometry",
      "+12+12",
      "-background",
      "#808080",
      all,
    ])
  ) {
    console.log(`\nall ${shots.length}  ->  ${all}`);
  }
}
