// The thermal cycle, and the hot spring Taq polymerase comes from.
import { caption, circle, g, path, rect, rod, text } from "../kit.mjs";
import { taq } from "./on-the-right-taq.mjs";

// Temperature axis: 40 °C at y 150, 100 °C at y 20.
const Y = (c) => 150 - ((c - 40) * 130) / 60;
const X0 = 70;
const X1 = 420;

const band = (lo, hi, cls) => rect(X0, Y(hi), X1 - X0, Y(lo) - Y(hi), 0, cls, { style: "stroke: none" });
const tick = (c, label) =>
  path(`M${X0 - 3} ${Y(c)}H${X0}`, "muted") + text(X0 - 8, Y(c) + 4, label, { anchor: "end" });

// Two cycles: up to denature, down to anneal, up to extend.
const pts = [
  [X0, Y(60)],
  [90, Y(95)],
  [128, Y(95)],
  [150, Y(58)],
  [190, Y(58)],
  [202, Y(72)],
  [244, Y(72)],
  [264, Y(95)],
  [302, Y(95)],
  [324, Y(58)],
  [364, Y(58)],
  [376, Y(72)],
  [X1, Y(72)],
];
const line = "M" + pts.map(([x, y]) => `${x} ${y.toFixed(1)}`).join("L");

const chart =
  band(94, 98, "tint2-accent") +
  band(50, 65, "tint-brand") +
  path(`M${X0} 14V150H${X1 + 10}`, "") +
  tick(96, "94–98 °C") +
  tick(72, "72 °C") +
  tick(57.5, "50–65 °C") +
  path(line, "accent m-draw", { pathLength: "1", style: "--i: 0" }) +
  text(109, Y(98) - 6, "denature") +
  text(170, Y(58) - 8, "anneal") +
  text(223, Y(72) - 8, "extend") +
  text(245, 172, "two cycles of many; times not to scale");

// A hot spring in section: ground, the pool, steam, and the rods of Thermus aquaticus in it.
const spring =
  path("M466 98H500C506 98 510 112 522 120C540 132 584 132 602 120C614 112 618 98 624 98H662V150H466Z", "muted tint-ink") +
  path("M500 98C506 98 510 112 522 120C540 132 584 132 602 120C614 112 618 98 624 98Z", "accent tint-accent") +
  path("M504 98q6 -4 12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0t12 0", "accent") +
  g(
    [516, 544, 572].map((x) => path(`M${x} 88q-5 -8 0 -16t0 -16`, "muted")).join(""),
    { opacity: ".8" },
  ) +
  rod(540, 110, 18, 20) +
  rod(568, 120, 18, -10) +
  rod(596, 108, 18, 30) +
  path("M603 102L626 70", "muted") +
  circle(636, 50, 24, "muted", { style: "fill: var(--bg)" }) +
  taq(636, 52);

export default {
  width: 680,
  height: 222,
  body:
    chart +
    spring +
    caption(564, 180, "Taq polymerase", ["from a hot-spring bacterium,", "it survives the hot step"]),
  sources: [
    [
      "Shamsian and colleagues, Microsystems and Nanoengineering (2025)",
      "https://doi.org/10.1038/s41378-025-00898-3",
    ],
    ["Ishino and Ishino, Frontiers in Microbiology (2014)", "https://doi.org/10.3389/fmicb.2014.00465"],
    ["Saiki and colleagues, Science (1988)", "https://doi.org/10.1126/science.2448875"],
    ["Brock and Freeze, Journal of Bacteriology (1969)", "https://doi.org/10.1128/jb.98.1.289-297.1969"],
  ],
};
