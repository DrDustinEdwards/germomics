// One cycle of PCR: the strands part, primers bind, Taq copies, and the copies become templates.
import { at, caption, duplex, ellipse, fade, g, path, rungs, slide, step, strand } from "../kit.mjs";

const T = "brand"; // template strands
const N = "accent"; // new DNA and primers

/** Taq polymerase closed on the strand it copies: a palm over it, a thumb under it. */
export const taq = (x, y, s = 1) =>
  at(
    x,
    y,
    ellipse(0, -6, 16, 13, `${N} tint2-${N}`) +
      ellipse(-4, -9, 7, 5, N, { opacity: ".6" }) +
      ellipse(3, 9, 11, 6, `${N} tint-${N}`),
    0,
    s,
  );

const heat = (x, y) =>
  g([0, 12, 24].map((dx) => path(`M${x + dx} ${y}q4 -5 0 -10t0 -10`, N)).join(""));

// Top strand at y 54, bottom strand at y 98; a primer or new strand sits 14 from its template.
const top = (x1, x2) => strand(x1, x2, 54, T);
const bottom = (x1, x2) => strand(x1, x2, 98, T);
const onTop = (x1, x2) => rungs(x1, x2, 57, 65) + strand(x1, x2, 68, N);
const onBottom = (x1, x2) => rungs(x1, x2, 87, 95) + strand(x1, x2, 84, N);

// Denature: the duplex opens into two strands.
const curved = (d) => path(d, `${T}`) + path(d, T, { transform: "translate(0 5)" });
const denature =
  duplex(14, 72, 66, { top: T, bottom: T }) +
  curved("M70 63.5C98 63.5 110 50 152 48.5") +
  curved("M70 77.5C98 77.5 110 92 152 95.5") +
  fade(heat(96, 34), 0);

const anneal = top(186, 324) + bottom(186, 324) + slide(onTop(196, 222), 1, 0, 8) + slide(onBottom(288, 314), 1, 0, -8);

const extend =
  top(356, 494) +
  bottom(356, 494) +
  onTop(364, 448) +
  taq(452, 64) +
  onBottom(404, 486) +
  taq(398, 92) +
  "";

const repeat = duplex(526, 666, 46, { top: T, bottom: N }) + duplex(526, 666, 88, { top: N, bottom: T });

export default {
  width: 680,
  height: 186,
  body:
    denature +
    step(170, 76) +
    anneal +
    step(340, 76) +
    extend +
    step(510, 76) +
    repeat +
    caption(85, 148, "Denature", ["heat parts the strands"]) +
    caption(255, 148, "Anneal", ["primers bind"]) +
    caption(425, 148, "Extend", ["Taq copies each strand"]) +
    caption(596, 148, "Repeat", ["copies become templates"]),
  sources: [
    ["Saiki and colleagues, Science (1988)", "https://doi.org/10.1126/science.2448875"],
    ["Chien, Edgar and Trela, Journal of Bacteriology (1976)", "https://doi.org/10.1128/jb.127.3.1550-1557.1976"],
    ["Mullis and Faloona, Methods in Enzymology (1987)", "https://doi.org/10.1016/0076-6879(87)55023-6"],
  ],
};
