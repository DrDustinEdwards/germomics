// Writes the episode figures in public/blog-diagrams from the drawings in ./drawings, with the
// title and description from app/lib/episode-diagrams.ts, so the file and the essay's diagram
// block cannot disagree. Then run `npx oxfmt public/blog-diagrams`.
//   node scripts/figures/build.mjs            every drawing
//   node scripts/figures/build.mjs rabies     the drawings whose file name contains "rabies"
import { readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EPISODE_DIAGRAMS } from "../../app/lib/episode-diagrams.ts";
import { figure } from "./kit.mjs";

const here = fileURLToPath(new URL(".", import.meta.url));
const out = fileURLToPath(new URL("../../public/blog-diagrams/", import.meta.url));
const only = process.argv[2] ?? "";

for (const name of readdirSync(`${here}drawings`).sort()) {
  const file = name.replace(/\.mjs$/, "");
  if (!file.includes(only)) continue;
  const entry = EPISODE_DIAGRAMS.find((d) => d.file === file);
  if (!entry) throw new Error(`${file}: no entry in app/lib/episode-diagrams.ts`);
  const drawing = (await import(`${here}drawings/${name}`)).default;
  writeFileSync(`${out}${file}.html`, figure({ title: entry.title, alt: entry.alt, ...drawing }));
  console.log(file);
}
