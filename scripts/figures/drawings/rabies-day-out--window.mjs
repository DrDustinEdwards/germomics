// Rabies: the window before symptoms. The bite, the nerve, the central nervous system, and the
// two bars that say what can still be done and when it is too late.
import { arrow, at, brain, bullet, caption, g, neuron, path, rect, text } from "../kit.mjs";

/** The bite: broken skin in section, with virus in the wound. */
const bite = (x, y) =>
  at(
    x,
    y,
    path("M-30 0H-6L0 12L6 0H30V18H-30Z", "muted tint-ink") +
      path("M-30 0H-6L0 12L6 0H30", "muted") +
      path("M-30 18H30", "muted", { opacity: ".7" }) +
      bullet(-14, -10, 20, "brand", 0.8) +
      bullet(10, -14, -30, "brand", 0.8) +
      bullet(-2, -24, 0, "brand", 0.8),
  );

/** The muscle the virus first multiplies in: fibers with their striations. */
const muscle = (x, y) =>
  at(
    x,
    y,
    g(
      [-14, -4, 6, 16]
        .map((dy) =>
          path(
            `M-38 ${dy}q10 -5 20 0t20 0t20 0q10 0 14 2q-4 2 -14 2t-20 0t-20 0t-20 0Z`,
            "brand tint-brand",
          ),
        )
        .join("") +
        [-14, -4, 6, 16]
          .map((dy) =>
            path(
              `M-24 ${dy - 1}v3M-12 ${dy - 1}v3M0 ${dy - 1}v3M12 ${dy - 1}v3M24 ${dy - 1}v3`,
              "brand",
              { opacity: ".45" },
            ),
          )
          .join(""),
    ) +
      bullet(-26, -30, 10, "brand", 0.8) +
      bullet(14, -32, -20, "brand", 0.8),
  );

/** The spinal cord and brain, cut in section. */
const cns = (x, y) =>
  at(
    x,
    y,
    path("M-10 2C-14 18 -18 34 -16 54H-4C-6 34 -2 18 2 4Z", "muted tint-ink") +
      path("M-11 14H-2M-13 26H-4M-14 38H-5", "muted", { opacity: ".5" }) +
      brain(6, -8, 1, "brand"),
  );

/** The salivary glands: a cluster of acini with a duct. */
const glands = (x, y) =>
  at(
    x,
    y,
    [
      [-14, -8, 11],
      [6, -14, 10],
      [12, 4, 12],
      [-6, 10, 9],
    ]
      .map(([dx, dy, r]) =>
        path(
          `M${dx} ${dy}m${-r} 0a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`,
          "brand tint-brand",
        ),
      )
      .join("") + path("M18 12C26 18 30 24 32 32", "muted"),
  );

const stage = (x, label, lines) => caption(x, 128, label, lines);

const row =
  bite(62, 74) +
  arrow(104, 70, 142, 70, "muted") +
  muscle(192, 74) +
  arrow(242, 70, 292, 70, "accent") +
  text(300, 34, "back along the nerve") +
  neuron(330, 76, 1, 0.8) +
  arrow(366, 70, 414, 70, "accent") +
  cns(458, 62) +
  arrow(498, 70, 548, 70, "brand") +
  text(523, 36, "outward again") +
  glands(600, 72) +
  stage(62, "A bite", ["virus in saliva enters"]) +
  stage(196, "In the muscle", ["it multiplies first"]) +
  stage(462, "The brain", ["and the spinal cord"]) +
  stage(600, "Salivary glands", ["and other organs"]);

// The two bars: what treatment can still do, and when it can no longer.
const BAR = 190;
const bars =
  rect(24, BAR, 440, 22, 11, "accent tint-accent") +
  text(244, BAR + 15, "Before symptoms: treatment can still prevent it") +
  rect(474, BAR, 182, 22, 11, "brand tint2-brand") +
  text(565, BAR + 15, "After: almost always fatal") +
  path(`M24 ${BAR + 32}H464`, "muted", { "stroke-dasharray": "4 4" }) +
  text(244, BAR + 50, "weeks to months, sometimes longer") +
  path(`M470 ${BAR - 8}V${BAR + 40}`, "muted") +
  text(470, BAR - 14, "symptoms begin");

export default {
  width: 680,
  height: 268,
  body: row + bars,
  sources: [
    [
      "World Health Organization, Rabies fact sheet",
      "https://www.who.int/news-room/fact-sheets/detail/rabies",
    ],
    [
      "Davis, Rall and Schnell, Annual Review of Virology (2015)",
      "https://doi.org/10.1146/annurev-virology-100114-055157",
    ],
    [
      "Fooks and colleagues, Nature Reviews Disease Primers (2017)",
      "https://doi.org/10.1038/nrdp.2017.91",
    ],
  ],
};
