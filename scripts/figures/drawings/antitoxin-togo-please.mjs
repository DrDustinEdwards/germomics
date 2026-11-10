// Corynephage beta carries tox into the bacterium; the B part binds HB-EGF on a human cell; the
// A part ADP-ribosylates EF-2 and the cell stops making protein.
import {
  arrow,
  at,
  bilayer,
  caption,
  circle,
  ellipse,
  path,
  phage,
  rect,
  ribosome,
  slide,
  text,
} from "../kit.mjs";

const A = (x, y) =>
  at(x, y, path("M-11 -4C-11 -12 -2 -14 4 -10C11 -5 11 6 4 10C-3 14 -11 9 -11 -4Z", "accent tint2-accent") + text(-2, 4, "A"));
const B = (x, y) =>
  at(x, y, path("M-9 -9C-2 -13 8 -9 9 -1C10 7 4 12 -3 11C-10 10 -13 -5 -9 -9Z", "brand tint2-brand") + text(-1, 4, "B"));

// 1. The bacterium, with the phage genome and its tox gene.
const cell1 =
  rect(16, 84, 168, 72, 36, "brand tint-brand") +
  rect(22, 90, 156, 60, 30, "brand", { opacity: ".55" }) +
  circle(94, 120, 24, "muted") +
  path("M94 96A24 24 0 0 1 116 112", "accent", { style: "stroke-width: 4" }) +
  text(130, 102, "tox", { anchor: "start" }) +
  text(94, 170, "corynephage beta") +
  phage(60, 60, 0.8) +
  arrow(70, 70, 86, 88, "muted", { "stroke-dasharray": "2 3" });

// The toxin the bacterium then makes, on its way to a human cell.
const made = A(214, 104) + B(232, 112) + arrow(190, 120, 206, 112, "muted");

// 2. The human cell: the toxin bound to HB-EGF, taken in, and A at work on EF-2.
const M = 128; // the membrane's upper leaflet

const human =
  path(`M268 ${M + 14}H664V268H268Z`, "tint-ink", { style: "stroke: none" }) +
  bilayer(268, 664, M) +
  text(660, 44, "human cell", { anchor: "end" }) +
  // HB-EGF in the membrane, with the toxin's B part on its head.
  rect(347, M - 16, 10, 34, 5, "muted tint-ink") +
  path(`M352 ${M - 16}v-10`, "muted") +
  ellipse(352, M - 30, 9, 6, "muted tint-ink") +
  text(386, M - 30, "HB-EGF", { anchor: "start" }) +
  slide(A(334, M - 64) + B(352, M - 48), 0, 0, -22) +
  arrow(290, M - 40, 316, M - 48, "muted") +
  // The toxin is taken in; the A part reaches the cytoplasm.
  arrow(352, M + 24, 376, M + 70, "muted", { "stroke-dasharray": "3 4" }) +
  // A adds ADP-ribose to EF-2.
  A(382, M + 86) +
  path(`M${382 + 13} ${M + 86}h10`, "accent") +
  text(400, M + 60, "ADP-ribose added", { anchor: "start" }) +
  ellipse(438, M + 88, 26, 17, "brand tint-brand") +
  text(438, M + 92, "EF-2") +
  // The ribosome cannot work: the chain is not made.
  ribosome(560, M + 92) +
  path(`M560 ${M + 70}q14 -10 26 -4`, "brand", { "stroke-dasharray": "3 4" }) +
  path(`M578 ${M + 58}L602 ${M + 82}M602 ${M + 58}L578 ${M + 82}`, "accent");

export default {
  width: 680,
  height: 330,
  body:
    cell1 +
    made +
    human +
    caption(100, 212, "A phage brings tox", ["a strain without the phage", "makes no toxin"]) +
    caption(352, 296, "B binds HB-EGF", ["and the toxin is taken in"]) +
    caption(566, 296, "A stops EF-2", ["protein synthesis halts"]),
  sources: [
    ["Freeman, Journal of Bacteriology (1951)", "https://doi.org/10.1128/jb.61.6.675-688.1951"],
    ["Holmes, Journal of Infectious Diseases (2000)", "https://doi.org/10.1086/315554"],
    ["Naglich, Metherall, Russell and Eidels, Cell (1992)", "https://doi.org/10.1016/0092-8674(92)90623-k"],
    ["Collier, Toxicon (2001)", "https://doi.org/10.1016/s0041-0101(01)00165-9"],
  ],
};
