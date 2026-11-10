// Leptospirosis: the cycle through reservoir mammals, and how a person is exposed and stops it.
import { arrow, caption, curve, drop, kidney, path, person, rat, spirochete, text } from "../kit.mjs";

/** The pond in perspective: water over wet soil, as a flat ellipse. */
const pond = (cx, cy) =>
  path(`M${cx - 110} ${cy}a110 36 0 1 0 220 0a110 36 0 1 0 -220 0`, "accent tint-accent") +
  path(`M${cx - 110} ${cy}a110 36 0 0 0 220 0`, "muted tint-ink") +
  path(`M${cx - 60} ${cy - 14}q8 -5 16 0t16 0M${cx + 14} ${cy - 20}q8 -5 16 0t16 0`, "accent", { opacity: ".7" });

// The reservoir: a rat, with the kidney it carries leptospires in.
const reservoir =
  rat(108, 104, 1) +
  kidney(240, 50, 0.6) +
  path("M178 92L216 68", "muted", { "stroke-dasharray": "2 3" }) +
  spirochete(250, 38, 17, 20, "accent") +
  spirochete(256, 58, 17, -14, "accent") +
  text(242, 104, "Leptospira in the kidney") +
  caption(112, 166, "Reservoir mammals", ["rats above all"]);

// Shed in urine, into the water and soil where the bacteria survive.
const shed = drop(176, 196) + arrow(158, 208, 212, 212, "muted") + text(150, 230, "urine");

const water =
  pond(300, 226) +
  spirochete(262, 220, 22, 8) +
  spirochete(320, 232, 22, -12) +
  spirochete(348, 214, 22, 16) +
  caption(300, 282, "Fresh water and wet soil", ["they survive outside a host"]);

// The cycle closes when another reservoir animal picks them up.
const back =
  curve(412, 198, 448, 24, 196, 32, "muted", { "stroke-dasharray": "4 4" }) +
  text(330, 20, "another reservoir animal is infected");

// A person is exposed through broken skin or a mucous membrane, and does not continue the cycle.
const human =
  person(576, 128, 1.6) +
  arrow(432, 214, 536, 168, "accent") +
  caption(576, 200, "A person", ["through broken skin or", "a mucous membrane"]) +
  text(576, 252, "the cycle stops here");

export default {
  width: 680,
  height: 316,
  body: reservoir + shed + water + back + human,
  sources: [
    ["Levett, Clinical Microbiology Reviews (2001)", "https://doi.org/10.1128/CMR.14.2.296-326.2001"],
    [
      "Haake and Levett, Current Topics in Microbiology and Immunology (2015)",
      "https://doi.org/10.1007/978-3-662-45059-8_5",
    ],
  ],
};
