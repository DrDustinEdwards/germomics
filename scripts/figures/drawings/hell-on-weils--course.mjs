// The two phases of leptospirosis, and what the severe form does.
import { arrow, at, caption, circle, drop, g, kidney, path, text } from "../kit.mjs";

// The illness curve: a first peak, a lull, then the immune phase.
const B = 150; // the baseline
const curve = `M60 ${B}C96 ${B} 104 54 148 54C190 54 196 ${B - 24} 228 ${B - 24}C262 ${B - 24} 268 70 310 70C352 70 362 ${B} 404 ${B}`;

const chart =
  path(`${curve}V${B}H60Z`, "accent tint-accent", { style: "stroke: none" }) +
  path(curve, "accent m-draw", { pathLength: "1", style: "--i: 0" }) +
  path(`M60 ${B}H420`, "muted") +
  at(420, B, path("M-4 -6L3 0L-4 6", "muted")) +
  circle(60, B, 4, "muted tint-ink") +
  text(60, B + 18, "exposure") +
  text(148, B + 18, "days") +
  text(310, B + 18, "weeks") +
  path(`M148 ${B}v5M228 ${B}v5M310 ${B}v5`, "muted");

/** A bracket over a span, with its label under it. */
const bracket = (x1, x2, y, label, lines) =>
  path(`M${x1} ${y + 8}V${y}H${x2}V${y + 8}`, "muted") +
  caption((x1 + x2) / 2, y - 10, label, []) +
  g(lines.map((line, i) => text((x1 + x2) / 2, y + 26 + i * 15, line)).join(""));

const phases =
  bracket(66, 196, 38, "Blood phase", ["bacteria in the blood:", "fever, headache, muscle pain"]) +
  bracket(204, 252, 38, "A lull", ["a brief", "improvement"]) +
  bracket(262, 398, 38, "Immune phase", ["antibodies appear and the", "bacteria leave in the urine"]);

// Most illness stays mild; a minority develop the severe form.
const severe =
  arrow(410, 96, 452, 96, "brand") +
  text(432, 84, "a minority") +
  caption(560, 48, "Weil's disease", ["the severe form"]) +
  g(
    [
      [478, 96, "jaundice"],
      [478, 128, "kidney failure"],
      [478, 160, "bleeding"],
    ]
      .map(([x, y, label]) => text(x + 34, y + 4, label, { anchor: "start" }))
      .join(""),
  ) +
  // jaundice: a yellowed eye, which reads at icon size where a yellowed hand does not
  at(492, 96, path("M-14 0C-8 -8 8 -8 14 0C8 8 -8 8 -14 0Z", "brand tint2-brand") + circle(0, 0, 4.5, "brand")) +
  kidney(490, 126, 0.4, "brand", { detail: false }) +
  drop(492, 154, "brand", 0.9);

export default {
  width: 680,
  height: 206,
  body: chart + phases + severe,
  sources: [
    ["Levett, Clinical Microbiology Reviews (2001)", "https://doi.org/10.1128/CMR.14.2.296-326.2001"],
    [
      "Haake and Levett, Current Topics in Microbiology and Immunology (2015)",
      "https://doi.org/10.1007/978-3-662-45059-8_5",
    ],
  ],
};
