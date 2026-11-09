// Draws the episode mechanism diagrams with Prelum's renderer (render/diagram-draw) into
// public/diagrams. The Mermaid source is app/lib/episode-diagrams.ts, which is also the text a
// Carrel draft inserts. Run: npm run diagrams
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDiagramModel } from "@drdustinedwards/site-helpers/render/diagram";
import { drawDiagrams, pruneDiagrams } from "@drdustinedwards/site-helpers/render/diagram-draw";
import { DIAGRAM_ASSET_PREFIX, DIAGRAM_COLORS } from "../app/lib/diagram-colors.ts";
import { EPISODE_DIAGRAMS } from "../app/lib/episode-diagrams.ts";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../public/diagrams");

const diagrams = EPISODE_DIAGRAMS.map((diagram) => {
  const model = buildDiagramModel({ title: diagram.title, alt: diagram.alt }, diagram.mermaid);
  return { key: model.key, source: model.source, label: diagram.slug };
});

await mkdir(dir, { recursive: true });
const drawn = await drawDiagrams({
  diagrams,
  dir,
  assetPrefix: DIAGRAM_ASSET_PREFIX,
  colors: DIAGRAM_COLORS,
  log: (line) => console.log(line),
});
if (drawn.stale.length) {
  await pruneDiagrams(dir, drawn.stale);
  console.log(`pruned ${drawn.stale.join(", ")}`);
}
console.log(
  `${drawn.written.length} written, ${drawn.current} already current, ${diagrams.length} diagrams`,
);
