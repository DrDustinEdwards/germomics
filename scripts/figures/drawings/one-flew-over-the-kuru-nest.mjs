// Prion templating: cells make PrPC, PrPSc refolds it into more PrPSc, and the misfolded form spreads.
import {
  arrow,
  at,
  bilayer,
  caption,
  cellBody,
  ellipse,
  g,
  neuron,
  path,
  rect,
  slide,
  step,
} from "../kit.mjs";

/** PrPC, the normal fold: a globular protein with three helices. */
export const prpc = (x, y, rot = 0) =>
  at(
    x,
    y,
    ellipse(0, 0, 15, 11, "accent tint-accent") +
      rect(-10, -6, 9, 5, 2.5, "accent tint2-accent") +
      rect(1, -7, 9, 5, 2.5, "accent tint2-accent") +
      rect(-5, 2, 11, 5, 2.5, "accent tint2-accent"),
    rot,
  );

/** One PrPSc unit, the misfolded form: flat beta strands stacked. */
export const prpsc = (x, y, rot = 0) =>
  at(
    x,
    y,
    [-6, 0, 6]
      .map((dy) =>
        path(`M-12 ${dy - 2}H6V${dy - 4}L12 ${dy}L6 ${dy + 4}V${dy + 2}H-12Z`, "brand tint2-brand"),
      )
      .join(""),
    rot,
  );

/** A fibril: PrPSc units in a stack, from y upward. */
const fibril = (x, y, count) =>
  g(Array.from({ length: count }, (_, i) => prpsc(x, y - i * 22)).join(""));

const small = (x, y) => prpsc(x, y).replace(/\)">/, ') scale(.55)">');

// 1. A cell membrane with PrPC on its surface.
const make =
  cellBody(14, 114, 142, 34, { r: 10 }) +
  bilayer(14, 156, 100) +
  [40, 85, 130].map((x) => path(`M${x} 100V86`, "accent") + prpc(x, 74)).join("");

// 2. A fibril of PrPSc; a PrPC unit arrives at the open end and refolds to match.
const template =
  fibril(250, 128, 3) +
  path("M238 58H256V54L262 62L256 70V66H238Z", "brand", { "stroke-dasharray": "2 3" }) +
  slide(prpc(318, 54), 0, 20, 0) +
  arrow(300, 58, 274, 62, "muted");

// 3. Two neurons; aggregates pass along the axon from one to the next.
const spread =
  neuron(420, 84) +
  path("M450 84C480 84 520 80 560 80", "muted") +
  neuron(592, 80, -1) +
  small(414, 92) +
  small(424, 76) +
  slide(g(small(486, 83) + small(526, 81)), 2, -30, 0) +
  small(586, 88) +
  small(598, 72);

export default {
  width: 680,
  height: 220,
  body:
    make +
    step(196, 86) +
    template +
    step(352, 86) +
    spread +
    caption(85, 182, "Cells make PrPC", ["the normal fold"]) +
    caption(262, 182, "PrPSc templates more", ["it refolds PrPC to match"]) +
    caption(505, 182, "It can spread", ["from cell to cell"]),
  sources: [
    ["Prusiner, Science (1982)", "https://doi.org/10.1126/science.6801762"],
    ["Pan and colleagues, PNAS (1993)", "https://doi.org/10.1073/pnas.90.23.10962"],
    ["Gajdusek, Gibbs and Alpers, Nature (1966)", "https://doi.org/10.1038/209794a0"],
    [
      "Alpers, Philosophical Transactions of the Royal Society B (2008)",
      "https://doi.org/10.1098/rstb.2008.0071",
    ],
  ],
};
