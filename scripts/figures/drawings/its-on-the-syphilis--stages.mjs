// The four stages of untreated syphilis, with what each one shows and when.
import { arrow, at, brain, caption, circle, g, heart, path, person, spirochete, text } from "../kit.mjs";

/** A chancre: a firm, round sore with a raised rim, on a patch of skin. */
const chancre = (x, y) =>
  at(
    x,
    y,
    circle(0, 0, 26, "muted tint-ink") +
      circle(0, 0, 11, "brand tint-brand") +
      circle(0, 0, 5, "brand tint2-brand") +
      path("M-20 -14q6 4 12 0M14 12q5 -4 8 -9", "muted", { opacity: ".5" }),
  );

/** The secondary rash: a body with spots, dense on the palms and the soles. */
const rash = (x, y) =>
  person(x, y, 1.5) +
  g(
    [
      [-13, 10],
      [-6, 4],
      [2, 9],
      [10, 3],
      [-10, 20],
      [0, 18],
      [9, 21],
      [-4, 28],
      [6, 30],
      [-18, 2],
      [16, 1],
      [-19, 14],
      [18, 13],
      [-8, 40],
      [5, 41],
    ]
      .map(([dx, dy]) => circle(x + dx * 1.2, y + dy * 1.2 - 8, 2.1, "brand tint2-brand"))
      .join(""),
  );

/** Latent: no visible sign, drawn as a clock with the bacteria still present. */
const latent = (x, y) =>
  at(
    x,
    y,
    circle(0, 0, 24, "muted", { "stroke-dasharray": "3 4" }) +
      path("M0 -13V0L9 7", "muted") +
      spirochete(0, 14, 18, 6, "accent"),
  );

/** Tertiary: the organs it can damage. */
const tertiary = (x, y) => heart(x - 20, y, 0.9, "brand") + brain(x + 22, y - 4, 0.85, "brand");

const T = 118; // the timeline

const stage = (x, label, when, lines) =>
  circle(x, T, 4.5, "muted tint-ink") +
  text(x, T - 14, when) +
  caption(x, T + 30, label, lines);

export default {
  width: 680,
  height: 232,
  body:
    // Treponema pallidum, the spirochete that causes it, enters at the left.
    spirochete(72, 44, 46, -10, "accent") +
    text(24, 76, "Treponema pallidum,", { anchor: "start" }) +
    text(24, 91, "a spiral bacterium", { anchor: "start" }) +
    arrow(104, 52, 128, 44, "muted") +
    chancre(166, 52) +
    rash(300, 34) +
    latent(438, 56) +
    tertiary(596, 56) +
    path("M24 118H656", "muted") +
    at(656, 118, path("M-4 -6L3 0L-4 6", "muted")) +
    stage(166, "Primary", "3 to 6 weeks", ["a sore where", "it entered"]) +
    stage(300, "Secondary", "weeks later", ["a rash, which can reach", "the palms and the soles"]) +
    stage(438, "Latent", "months to years", ["no signs at all,", "still infected"]) +
    stage(596, "Tertiary", "10 to 30 years", ["damage to the heart,", "vessels, brain and nerves"]),
  sources: [
    ["CDC, About Syphilis", "https://www.cdc.gov/syphilis/about/index.html"],
    [
      "Workowski and colleagues, MMWR Recommendations and Reports 70(4) (2021)",
      "https://doi.org/10.15585/mmwr.rr7004a1",
    ],
    ["Stamm, Microbial Cell (2016)", "https://doi.org/10.15698/mic2016.09.523"],
  ],
};
