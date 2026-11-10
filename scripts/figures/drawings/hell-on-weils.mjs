// Leptospirosis: the cycle through reservoir mammals, and how a person is exposed and stops it.
// Laid out as a cycle: the rat sheds into water and soil, a person picks it up there through
// broken skin or a mucous membrane, and the cycle itself carries on through the next animal.
import { arrow, at, bust, caption, circle, curve, kidney, path, pool, rat, rect, spirochete, text } from "../kit.mjs";

// The water is the accent, so the bacteria are drawn in the brand color to stay apart from it.
const BUG = "brand";

// The reservoir: a rat, with the kidney it carries leptospires in, called out.
const reservoir =
  text(112, 86, "Reservoir mammals, rats above all", { primary: true }) +
  rat(112, 150, 1) +
  kidney(150, 142, 0.4, "brand", { detail: false }) +
  path("M163 138H204", "muted", { "stroke-dasharray": "2 3" }) +
  circle(205, 138, 1.8, "muted", { style: "fill: var(--muted)" }) +
  text(212, 133, "Leptospira live in", { anchor: "start" }) +
  text(212, 148, "the kidney tubules", { anchor: "start" });

// Shed in urine, into the water and soil where the bacteria survive for weeks.
const shed = curve(104, 198, 128, 252, 198, 284, "muted") + text(178, 234, "Urine", { anchor: "start" });

const water =
  pool(302, 304, "lepto-pool") +
  spirochete(268, 294, 20, 12, BUG) +
  spirochete(300, 314, 20, -16, BUG) +
  spirochete(240, 312, 20, 6, BUG) +
  caption(288, 352, "Fresh water and wet soil", ["they stay alive outside a host"]);

// A person is exposed through broken skin or a mucous membrane, and does not pass it on.
const human =
  curve(390, 292, 442, 272, 458, 204, "muted") +
  text(516, 86, "An incidental host", { primary: true }) +
  bust(468, 96, 1.05) +
  caption(516, 244, "A person", ["the cycle stops here:", "we do not pass it on"]);

// The inset: how it gets in. Skin in section, with a break the bacteria go through.
const IX = 576;
const IY = 100;
const inset =
  rect(IX, IY, 88, 68, 3, "muted", { style: "fill: var(--bg)" }) +
  at(
    IX,
    IY,
    // the dermis below, the epidermis as a band across it, and a cut straight through both
    rect(0, 38, 88, 30, 0, "muted tint-ink") +
      rect(0, 28, 34, 10, 0, "muted tint2-ink") +
      rect(50, 28, 38, 10, 0, "muted tint2-ink") +
      path("M34 28L42 54L50 28", "muted") +
      spirochete(18, 14, 16, 16, BUG) +
      spirochete(68, 12, 16, -14, BUG) +
      spirochete(44, 60, 13, 70, BUG) +
      arrow(30, 18, 41, 44, BUG),
  ) +
  path(`M${IX} ${IY}L556 140M${IX} ${IY + 68}L556 146`, "muted", { opacity: ".45" }) +
  caption(IX + 44, IY + 90, "Broken skin", ["or mucosa"]);

// The cycle closes through the animals, not through us.
const back =
  curve(516, 72, 330, 18, 150, 70, "muted", { "stroke-dasharray": "4 4" }) +
  text(334, 14, "the cycle carries on through the animals");

export default {
  width: 680,
  height: 392,
  body: reservoir + shed + water + human + inset + back,
  sources: [
    ["Levett, Clinical Microbiology Reviews (2001)", "https://doi.org/10.1128/CMR.14.2.296-326.2001"],
    [
      "Haake and Levett, Current Topics in Microbiology and Immunology (2015)",
      "https://doi.org/10.1007/978-3-662-45059-8_5",
    ],
  ],
};
