// Influenza A: the two surface proteins, and the two ways the virus changes.
import { arrow, at, caption, circle, ellipse, envelopedVirus, g, path, rect, text } from "../kit.mjs";

/** The eight RNA segments inside a virion, as short coiled strands. */
const segments = (r, cls = "muted") =>
  g(
    [
      [-9, -11],
      [3, -12],
      [-12, -3],
      [1, -4],
      [-10, 5],
      [3, 4],
      [-6, 12],
      [6, 11],
    ]
      .map(([dx, dy]) => path(`M${dx - 5} ${dy}q2.5 -3 5 0t5 0`, cls))
      .join(""),
  );

/**
 * One virion: the envelope, the eight segments, and the two surface proteins. H is a stalk with a
 * three-lobed head; N is a stalk with a flat four-lobed head. Spots mark changed H and N.
 */
function virion(x, y, { r = 26, scale = 1, spots = 0, cls = "brand", hCls = "brand", nCls = "accent" } = {}) {
  const spikes = [];
  for (let i = 0; i < 14; i += 1) {
    const a = (i * 360) / 14;
    const isN = i % 3 === 2;
    const head = isN
      ? rect(-5, -r - 11, 10, 5, 2, `${nCls} tint2-${nCls}`)
      : path(`M-4 ${-r - 6}h8l-2 -6h-4Z`, `${hCls} tint2-${hCls}`);
    const marked = spots > 0 && i % Math.max(1, Math.round(14 / spots)) === 0;
    spikes.push(
      at(0, 0, path(`M0 ${-r}V${-r - 6}`, isN ? nCls : hCls) + head + (marked ? circle(0, -r - 14, 2.6, `${hCls} tint2-${hCls}`) : ""), a),
    );
  }
  return at(x, y, circle(0, 0, r, `${cls} tint-${cls}`) + segments(r) + spikes.join(""), 0, scale);
}

// Left panel: the surface proteins, named.
const left =
  virion(104, 86, { r: 30 }) +
  path("M78 116L40 148", "muted") +
  path("M130 116L168 190", "muted") +
  caption(24, 166, "N, neuraminidase", ["cuts the virus free", "of the cell it leaves"], "start") +
  caption(24, 232, "H, hemagglutinin", ["binds sialic acid", "on the cell it enters"], "start") +
  text(104, 40, "eight RNA segments inside");

// Right panel, top: drift, point mutations accumulating in H and N.
const drift =
  text(262, 44, "Drift", { primary: true, anchor: "start" }) +
  text(262, 62, "point mutations add up, a little at a time", { anchor: "start" }) +
  virion(306, 112, { r: 20, spots: 0 }) +
  arrow(340, 112, 372, 112) +
  virion(406, 112, { r: 20, spots: 3 }) +
  arrow(440, 112, 472, 112) +
  virion(506, 112, { r: 20, spots: 7 });

// Right panel, bottom: shift, two viruses in one cell and a new mix of segments.
const shift =
  text(262, 184, "Shift", { primary: true, anchor: "start" }) +
  text(262, 202, "a cell infected by two viruses swaps whole segments", { anchor: "start" }) +
  virion(296, 244, { r: 17, cls: "brand", hCls: "brand", nCls: "brand" }) +
  text(296, 284, "a bird virus") +
  virion(296, 324, { r: 17, cls: "accent", hCls: "accent", nCls: "accent" }) +
  text(296, 364, "a human virus") +
  // The infected cell, with segments of both inside.
  ellipse(442, 296, 56, 44, "muted tint-ink") +
  g(
    [
      [-28, -22, "brand"],
      [-12, -26, "accent"],
      [4, -20, "brand"],
      [-26, -8, "accent"],
      [-8, -8, "brand"],
      [10, -6, "accent"],
      [-20, 8, "brand"],
      [0, 8, "accent"],
      [16, 8, "brand"],
      [-10, 22, "accent"],
      [8, 22, "brand"],
    ]
      .map(([dx, dy, c]) => path(`M${442 + dx - 5} ${296 + dy}q2.5 -3 5 0t5 0`, c))
      .join(""),
  ) +
  text(442, 358, "one cell, both sets of segments") +
  arrow(330, 256, 386, 282) +
  arrow(330, 312, 386, 306) +
  arrow(502, 296, 544, 296) +
  virion(600, 296, { r: 20, cls: "brand", hCls: "accent", nCls: "brand" }) +
  text(600, 344, "a new mix");

export default {
  width: 680,
  height: 400,
  body: left + path("M228 28V380", "muted", { "stroke-dasharray": "2 5" }) + drift + shift,
  sources: [
    ["CDC, Types of influenza viruses", "https://www.cdc.gov/flu/about/viruses-types.html"],
    ["CDC, How influenza viruses change", "https://www.cdc.gov/flu/php/viruses/change.html"],
    ["Bouvier and Palese, Vaccine (2008)", "https://doi.org/10.1016/j.vaccine.2008.07.039"],
    ["Webster and colleagues, Microbiological Reviews (1992)", "https://doi.org/10.1128/mr.56.1.152-179.1992"],
  ],
};
