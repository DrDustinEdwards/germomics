// Cholera toxin on a cell of the small intestine: B binds GM1, A1 locks Gs on, chloride leaves.
import {
  arrow,
  at,
  bilayer,
  caption,
  cellBody,
  circle,
  drop,
  g,
  path,
  rect,
  slide,
  text,
} from "../kit.mjs";

const M = 96; // top of the membrane; the inner leaflet is at M + 14

/** The toxin seen from the side: five B subunits in a row under the A subunit. */
export const toxin = (x, y) =>
  at(
    x,
    y,
    path("M-8 -14L0 -30L8 -14Z", "brand tint2-brand") +
      path("M0 -14V-4", "brand") +
      [-20, -10, 0, 10, 20].map((dx) => circle(dx, 2, 6, "brand tint-brand")).join(""),
  );

/** GM1 on the outer leaflet: a short sugar chain. */
const gm1 = (x) =>
  path(`M${x} ${M}V${M - 8}`, "accent") + circle(x, M - 10, 2, "accent tint2-accent");

/** Adenylate cyclase spanning the membrane, with Gs held against it on the inside. */
const cyclase = (x) =>
  rect(x - 9, M - 6, 18, 26, 6, "muted tint-ink") +
  path(`M${x - 3} ${M - 2}V${M + 16}M${x + 3} ${M - 2}V${M + 16}`, "muted", { opacity: ".7" }) +
  circle(x - 22, M + 30, 10, "accent tint2-accent") +
  text(x - 22, M + 34, "Gs");

/** CFTR, the chloride channel, open: two halves with a gap. */
const cftr = (x) =>
  rect(x - 14, M - 8, 10, 30, 5, "brand tint2-brand") + rect(x + 4, M - 8, 10, 30, 5, "brand tint2-brand");

const camp = (x, y) =>
  g(
    [
      [0, 0],
      [14, -6],
      [26, 4],
      [8, 14],
      [22, 18],
      [36, 10],
      [-6, 22],
      [34, 26],
    ]
      .map(([dx, dy]) => circle(x + dx, y + dy, 3, "accent tint2-accent"))
      .join(""),
  );

const cell =
  cellBody(16, M + 14, 648, 104, { nucleus: [96, M + 62] }) +
  bilayer(16, 664, M) +
  text(24, 26, "gut lumen", { anchor: "start" }) +
  text(24, M + 96, "inside the cell", { anchor: "start" });

// 1. B binds GM1.
const bind = gm1(92) + gm1(102) + gm1(112) + gm1(122) + gm1(132) + toxin(112, M - 20);

// 2. A1 inside, Gs locked on, cAMP piles up.
const lock =
  path(`M150 ${M - 36}C206 ${M - 36} 236 ${M + 10} 262 ${M + 38}`, "brand", {
    "stroke-dasharray": "3 4",
  }) +
  path(`M258 ${M + 30}L274 ${M + 40}L260 ${M + 50}Z`, "brand tint2-brand") +
  cyclase(310) +
  arrow(322, M + 34, 344, M + 48) +
  camp(352, M + 46);

// 3. Chloride out through CFTR, water after it.
const out =
  cftr(560) +
  slide(arrow(560, M + 60, 560, M - 44, "brand"), 1, 0, 16) +
  text(560, M - 54, "Cl⁻", { primary: true }) +
  g(drop(600, M - 30) + drop(616, M - 52, "accent", 0.8) + drop(596, M - 66, "accent", 0.7));

export default {
  width: 680,
  height: 280,
  body:
    cell +
    bind +
    lock +
    out +
    caption(112, 248, "B binds GM1", ["on the gut cell"]) +
    caption(330, 248, "A1 locks Gs on", ["cAMP stays high"]) +
    caption(580, 248, "Chloride pours out", ["and water follows"]),
  sources: [
    [
      "Holmgren, Lönnroth and Svennerholm, Infection and Immunity (1973)",
      "https://doi.org/10.1128/iai.8.2.208-214.1973",
    ],
    ["Gill and Meren, PNAS (1978)", "https://doi.org/10.1073/pnas.75.7.3050"],
    ["Field, Journal of Clinical Investigation (2003)", "https://doi.org/10.1172/JCI18326"],
  ],
};
