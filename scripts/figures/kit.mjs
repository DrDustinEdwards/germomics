// The figure library: every part the episode figures draw, in the hairline style of
// docs/figure-style.md. A part returns SVG text at the origin or at the point it is given.
// build.mjs composes the parts into the files in public/blog-diagrams.

const n = (v) => Number(v.toFixed(1));

/** An attribute list from an object, skipping empty values. */
function attrs(a) {
  return Object.entries(a)
    .filter(([, v]) => v !== undefined && v !== null && v !== false && v !== "")
    .map(([k, v]) => ` ${k}="${typeof v === "number" ? n(v) : v}"`)
    .join("");
}

export const el = (tag, a = {}, inner) =>
  inner === undefined ? `<${tag}${attrs(a)} />` : `<${tag}${attrs(a)}>${inner}</${tag}>`;
export const g = (inner, a = {}) => el("g", a, inner);
export const at = (x, y, inner, rot = 0, scale = 1) =>
  g(
    inner,
    {
      transform:
        `translate(${n(x)} ${n(y)})` +
        (rot ? ` rotate(${n(rot)})` : "") +
        (scale !== 1 ? ` scale(${scale})` : ""),
    },
  );
export const path = (d, cls = "", extra = {}) => el("path", { class: `ln ${cls}`.trim(), d, ...extra });
export const circle = (cx, cy, r, cls = "", extra = {}) =>
  el("circle", { class: `ln ${cls}`.trim(), cx, cy, r, ...extra });
export const ellipse = (cx, cy, rx, ry, cls = "", extra = {}) =>
  el("ellipse", { class: `ln ${cls}`.trim(), cx, cy, rx, ry, ...extra });
export const rect = (x, y, w, h, rx, cls = "", extra = {}) =>
  el("rect", { class: `ln ${cls}`.trim(), x, y, width: w, height: h, rx, ...extra });

/** Motion wrappers (app/app.css): each part is complete at rest. */
export const fade = (inner, i = 0) => g(inner, { class: "m-fade", style: `--i: ${i}` });
export const slide = (inner, i, fx, fy) =>
  g(inner, { class: "m-slide", style: `--i: ${i}; --fx: ${fx}px; --fy: ${fy}px` });

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function text(x, y, s, { primary = false, anchor = "middle" } = {}) {
  return el(
    "text",
    { class: primary ? "label-primary" : "label-secondary", x, y, "text-anchor": anchor },
    esc(s),
  );
}

/** A step caption: a primary line and up to two secondary lines under it. */
export function caption(x, y, head, lines = [], anchor = "middle") {
  let out = text(x, y, head, { primary: true, anchor });
  lines.forEach((line, i) => {
    out += text(x, y + 18 + i * 15, line, { anchor });
  });
  return out;
}

// Arrows

export const chevron = (x, y, rot = 0, cls = "muted") => at(x, y, path("M-4 -6L3 0L-4 6", cls), rot);

/** A straight arrow with its head at the end point. */
export function arrow(x1, y1, x2, y2, cls = "muted", extra = {}) {
  const rot = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return path(`M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}`, cls, extra) + chevron(x2, y2, rot, cls);
}

/** A curved arrow through one control point. */
export function curve(x1, y1, cx, cy, x2, y2, cls = "muted", extra = {}) {
  const rot = (Math.atan2(y2 - cy, x2 - cx) * 180) / Math.PI;
  return path(`M${x1} ${y1}Q${cx} ${cy} ${x2} ${y2}`, cls, extra) + chevron(x2, y2, rot, cls);
}

/** The step marker between panels. */
export const step = (x, y) => chevron(x, y, 0, "muted");

// Membranes and cells

/**
 * A lipid bilayer from x1 to x2: two rows of heads with their tails meeting in the middle.
 * The heads are a dotted stroke, so the membrane reads as many small parts at any width.
 */
export function bilayer(x1, x2, y, { gap = 14, cls = "muted" } = {}) {
  const top = y;
  const bottom = y + gap;
  let tails = "";
  for (let x = x1; x <= x2; x += 7) {
    tails += `M${x} ${top + 3}v${gap / 2 - 3}M${x} ${bottom - 3}v-${gap / 2 - 3}`;
  }
  return (
    path(`M${x1} ${top}H${x2}M${x1} ${bottom}H${x2}`, `dots ${cls}`) +
    path(tails, cls, { opacity: ".6" })
  );
}

/** A curved bilayer along a circle, for a cell or vesicle in cross-section. */
export function ringBilayer(cx, cy, r, { gap = 10, cls = "muted", from = 0, to = 360 } = {}) {
  const arc = (rad) => {
    const a0 = (from * Math.PI) / 180;
    const a1 = (to * Math.PI) / 180;
    const p0 = [cx + rad * Math.cos(a0), cy + rad * Math.sin(a0)];
    const p1 = [cx + rad * Math.cos(a1), cy + rad * Math.sin(a1)];
    if (to - from >= 360) return `M${n(cx - rad)} ${cy}a${rad} ${rad} 0 1 0 ${2 * rad} 0a${rad} ${rad} 0 1 0 -${2 * rad} 0`;
    return `M${n(p0[0])} ${n(p0[1])}A${rad} ${rad} 0 ${to - from > 180 ? 1 : 0} 1 ${n(p1[0])} ${n(p1[1])}`;
  };
  let tails = "";
  const step = 360 / Math.round((2 * Math.PI * r) / 7);
  for (let a = from; a < to; a += step) {
    const t = (a * Math.PI) / 180;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const p = (rad) => `${n(cx + rad * c)} ${n(cy + rad * s)}`;
    tails += `M${p(r - 3)}L${p(r - gap / 2)}M${p(r - gap + 3)}L${p(r - gap / 2)}`;
  }
  return path(`${arc(r)}${arc(r - gap)}`, `dots ${cls}`) + path(tails, cls, { opacity: ".6" });
}

/** A cell cut open: the cytoplasm as an ink tint, with a nucleus. */
export function cellBody(x, y, w, h, { nucleus = null, r = 14 } = {}) {
  // Square top: the cytoplasm meets the membrane drawn above it.
  const body = `M${x} ${y}H${x + w}V${y + h - r}a${r} ${r} 0 0 1 -${r} ${r}H${x + r}a${r} ${r} 0 0 1 -${r} -${r}Z`;
  let out = path(body, "tint-ink", { style: "stroke: none" });
  if (nucleus) {
    const [nx, ny] = nucleus;
    out += ellipse(nx, ny, 18, 12, "muted tint-ink") + ellipse(nx + 3, ny - 1, 5, 4, "muted tint-ink");
  }
  return out;
}

/** Microvilli along an apical membrane: finger shapes rising from y. */
export function microvilli(x1, x2, y, { h = 22, w = 8, gap = 4 } = {}) {
  let d = `M${x1} ${y}`;
  for (let x = x1; x + w <= x2; x += w + gap) {
    d += `H${x}V${y - h + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V${y}`;
  }
  d += `H${x2}`;
  return path(d, "muted tint-ink");
}

// Organisms and particles

/** A rod-shaped bacterium with its envelope drawn as two lines. */
export function rod(x, y, len = 34, rot = 0, cls = "brand", { flagellum = false } = {}) {
  const h = 12;
  let inner =
    rect(-len / 2, -h / 2, len, h, h / 2, `${cls} tint2-${cls}`) +
    rect(-len / 2 + 3, -h / 2 + 3, len - 6, h - 6, (h - 6) / 2, cls);
  if (flagellum) inner = path(`M${len / 2} 0c6 -6 10 6 16 0s10 -6 14 0`, cls) + inner;
  return at(x, y, inner, rot);
}

/** A spirochete: a tight helix with hooked ends, as Leptospira and Treponema are drawn. */
export function spirochete(x, y, len = 60, rot = 0, cls = "accent", { hooks = true } = {}) {
  const turns = Math.round(len / 6);
  let d = `M${-len / 2} 0`;
  for (let i = 0; i < turns; i += 1) {
    const x0 = -len / 2 + (i * len) / turns;
    const w = len / turns;
    d += `Q${n(x0 + w / 4)} -4 ${n(x0 + w / 2)} 0T${n(x0 + w)} 0`;
  }
  let hook = "";
  if (hooks) hook = path(`M${-len / 2} 0q-5 0 -5 -6M${len / 2} 0q5 0 5 6`, cls);
  return at(x, y, path(d, cls) + hook, rot);
}

/** A bacteriophage: an icosahedral head with facets, collar, striped tail sheath, baseplate, fibers. */
export function phage(x, y, scale = 1, rot = 0, cls = "brand") {
  const r = 14;
  const hex = [0, 1, 2, 3, 4, 5]
    .map((i) => {
      const a = ((i * 60 - 90) * Math.PI) / 180;
      return `${n(r * Math.cos(a))} ${n(r * Math.sin(a) - 30)}`;
    })
    .join("L");
  const inner =
    path(`M${hex}Z`, `${cls} tint2-${cls}`) +
    path(`M0 -44L0 -30L-12 -23M0 -30L12 -23M0 -30L0 -16`, cls, { opacity: ".7" }) +
    rect(-4, -16, 8, 4, 1, cls) +
    rect(-3.5, -12, 7, 20, 1.5, `${cls} tint-${cls}`) +
    path("M-3.5 -7H3.5M-3.5 -2H3.5M-3.5 3H3.5", cls, { opacity: ".7" }) +
    path("M-7 8H7", cls) +
    path("M-6 8L-14 18L-12 24M6 8L14 18L12 24M-2 8L-5 20M2 8L5 20", cls);
  return at(x, y, inner, rot, scale);
}

/** An enveloped virus in cross-section with surface spikes. */
export function envelopedVirus(x, y, r = 18, cls = "brand", spikeCls = "accent", spikes = 12) {
  let out = circle(0, 0, r, `${cls} tint-${cls}`) + circle(0, 0, r - 4, cls, { opacity: ".6" });
  for (let i = 0; i < spikes; i += 1) {
    const a = (i * 360) / spikes;
    out += at(0, 0, path(`M0 ${-r}V${-r - 7}`, spikeCls) + circle(0, -r - 9, 2.4, `${spikeCls} tint2-${spikeCls}`), a);
  }
  return at(x, y, out);
}

/** The rabies virion: bullet-shaped, with a coiled nucleocapsid inside. */
export function bullet(x, y, rot = 0, cls = "brand", s = 1) {
  const inner =
    path("M-11 -6H4C11 -6 11 6 4 6H-11Z", `${cls} tint2-${cls}`) +
    path("M-7 -3.5V3.5M-4 -3.5V3.5M-1 -3.5V3.5M2 -3.5V3.5", cls, { opacity: ".7" });
  return at(x, y, inner, rot, s);
}

/** An antibody, a Y with its two arms tinted. */
export function antibody(x, y, rot = 0, cls = "accent", s = 1) {
  const inner =
    path("M0 14V2", cls) +
    rect(-2.5, 2, 5, 12, 2.5, `${cls} tint2-${cls}`) +
    at(-6, -4, rect(-2.5, -8, 5, 14, 2.5, `${cls} tint2-${cls}`), -40) +
    at(6, -4, rect(-2.5, -8, 5, 14, 2.5, `${cls} tint2-${cls}`), 40);
  return at(x, y, inner, rot, s);
}

/** A person, a filled silhouette (never a stick figure). */
export function person(x, y, s = 1, cls = "tint-brand") {
  return at(
    x,
    y,
    circle(0, -14, 6.5, "") +
      path(
        "M-5 -6.5H5C10 -6.5 12 -3 12 1L13 14H8L7 30H1.5L0 15L-1.5 30H-7L-8 14H-13L-12 1C-12 -3 -10 -6.5 -5 -6.5Z",
        cls,
      ),
    0,
    s,
  );
}

/**
 * A rat in profile, nose to the left. The silhouette is traced from the reference drawing with
 * scripts/figures/trace.py and restyled flat: a hairline outline over an ink tint, with the ear,
 * eye, whiskers and tail drawn over it. 150 x 76 before scaling, feet on y 76.
 */
export function rat(x, y, s = 1, dir = 1) {
  const shape =
    path(
      "M71.7 66.8C71.7 66.4 71.7 65.8 71.7 65.6C71.8 64.9 70.7 65.1 68.8 66.1C65.2 67.9 61.0 64.8 64.0 62.5C67.1 60.0 68.5 59.7 75.6 59.8C81.2 59.8 82.2 59.7 80.5 59.2C79.4 58.9 78.2 58.4 77.8 58.1C73.8 54.8 61.4 52.8 57.4 54.9C55.7 55.7 52.6 57.1 50.5 57.9C46.9 59.2 44.0 60.9 42.1 62.7C40.3 64.4 30.7 66.6 29.9 65.4C29.6 65.1 28.4 64.9 27.0 64.8C24.1 64.8 22.8 63.9 23.9 62.6C24.4 61.9 24.2 61.7 22.8 61.2C20.8 60.5 20.4 58.9 22.0 58.4C22.6 58.2 23.6 57.8 24.2 57.5C24.9 57.2 26.8 56.9 28.6 56.8C33.7 56.5 35.6 54.3 36.4 47.9C37.0 42.7 28.1 35.4 20.9 35.4C15.9 35.4 12.3 34.7 9.0 33.1C7.8 32.5 6.0 31.7 5.0 31.2C3.0 30.3 0.0 26.1 0.0 24.1C0.0 22.4 0.9 21.3 4.8 18.5C6.3 17.4 7.4 16.3 7.2 16.0C7.0 15.6 7.1 15.6 7.5 15.8C8.2 16.2 13.1 12.9 13.1 12.1C13.1 11.8 13.4 11.3 13.7 11.1C14.0 10.8 14.0 10.9 13.8 11.3C13.3 12.2 14.3 12.3 14.9 11.5C15.0 11.2 17.6 10.1 20.4 9.1C24.9 7.5 25.8 7.0 26.1 5.7C26.7 3.1 28.7 0.4 30.2 0.0C31.8 -0.4 33.7 0.5 33.4 1.5C33.3 1.9 33.5 3.1 33.9 4.2L34.6 6.1L36.1 4.7C39.4 1.6 44.4 2.5 45.4 6.4C46.5 10.7 52.1 11.3 60.4 7.9C76.4 1.5 91.6 2.4 103.4 10.3C104.8 11.2 106.1 11.8 106.4 11.7C106.6 11.5 106.8 11.6 106.7 11.9C106.6 12.1 107.8 13.6 109.4 15.1L112.2 17.8L116.1 16.9C122.8 15.3 132.2 16.5 139.3 19.7C144.9 22.2 142.6 22.7 136.0 20.4C131.2 18.7 123.9 18.0 118.4 18.7C113.6 19.3 113.2 19.7 115.3 22.4C118.1 25.9 120.8 33.1 122.0 39.9C123.9 51.0 130.1 55.2 144.6 55.2L150.0 55.2L150.0 58.7L150.0 62.1L146.0 62.5C140.8 63.0 132.7 62.0 127.5 60.1C119.6 57.3 117.1 57.3 111.2 59.9C108.6 61.1 107.7 61.2 102.9 60.9L97.5 60.5L97.4 62.1C97.1 64.1 90.6 65.7 82.3 65.8C78.6 65.8 76.3 66.1 75.3 66.6C73.5 67.7 71.8 67.7 71.7 66.8Z",
      "muted tint-ink",
    ) +
    path("M22 10C17 0 31 -5 39 0C45 4 46 12 42 16", "muted") +
    circle(16, 22, 2.2, "muted", { style: "fill: var(--muted)" }) +
    path("M2 30C-4 27 -9 25 -13 25M2 33C-4 34 -9 36 -12 38", "muted", { opacity: ".7" }) +
    path("M132 33C146 27 158 23 168 22", "muted", { style: "stroke-width: 2.2" });
  return at(
    x,
    y,
    g(at(-75, -38, shape, 0, 1), { transform: `scale(${dir} 1)` }),
    0,
    s,
  );
}

/** A kidney cut lengthwise: cortex, medulla with pyramids, pelvis and ureter. */
export function kidney(x, y, s = 1, cls = "brand") {
  const inner =
    path(
      "M10 -44C34 -44 46 -20 44 4C42 30 26 46 6 44C-12 42 -14 28 -8 18C-4 12 -4 -10 -8 -16C-16 -30 -10 -44 10 -44Z",
      `${cls} tint-${cls}`,
    ) +
    path(
      "M12 -34C28 -32 36 -14 34 4C32 22 22 34 8 34",
      cls,
      { opacity: ".7", "stroke-dasharray": "2 3" },
    ) +
    path("M16 -22L26 -12L14 -6ZM18 2L30 4L18 12ZM14 22L24 28L10 30Z", `${cls} tint2-${cls}`) +
    path("M-4 -10C6 -8 8 18 -4 20", cls) +
    path("M-6 18C-10 26 -16 36 -18 54", cls);
  return at(x, y, inner, 0, s);
}

/** Water over soil, in section: wavy surface, the water as an accent tint, the soil as grains. */
export function waterSoil(x1, x2, y, { depth = 34, soil = 22 } = {}) {
  let wave = `M${x1} ${y}`;
  for (let x = x1; x < x2; x += 16) wave += `q4 -4 8 0t8 0`;
  const water = `${wave}V${y + depth}H${x1}Z`;
  let grains = "";
  for (let x = x1 + 6, i = 0; x < x2 - 4; x += 11, i += 1) {
    grains += circle(x + (i % 2) * 4, y + depth + 6 + (i % 3) * 5, 1.6 + (i % 2), "muted tint-ink");
  }
  return (
    path(water, "accent tint-accent") +
    path(`M${x1} ${y + depth}H${x2}V${y + depth + soil}H${x1}Z`, "muted tint-ink") +
    grains
  );
}

/** A drop of urine or water. */
export const drop = (x, y, cls = "accent", s = 1) =>
  at(x, y, path("M0 -12C5 -4 8 0 8 4A8 8 0 0 1 -8 4C-8 0 -5 -4 0 -12Z", `${cls} tint2-${cls}`), 0, s);

/** One DNA strand as a narrow ribbon, so a strand reads as a molecule and not a rule. */
export const strand = (x1, x2, y, cls = "brand") =>
  rect(Math.min(x1, x2), y - 2.5, Math.abs(x2 - x1), 5, 2.5, `${cls} tint-${cls}`);

/** Base-pair rungs between two strands. */
export function rungs(x1, x2, y1, y2) {
  let d = "";
  for (let x = x1 + 4; x < x2 - 1; x += 6) d += `M${x} ${y1}V${y2}`;
  return path(d, "muted", { opacity: ".8" });
}

/** A DNA duplex from x1 to x2: two strand ribbons with rungs. Classes color each strand. */
export function duplex(x1, x2, y, { gap = 14, top = "brand", bottom = "brand" } = {}) {
  return rungs(x1, x2, y + 3, y + gap - 3) + strand(x1, x2, y, top) + strand(x1, x2, y + gap, bottom);
}

/** A ribosome: two subunits on a strand of mRNA. */
export function ribosome(x, y, cls = "muted") {
  return at(
    x,
    y,
    path("M-16 -2C-18 -14 -8 -20 2 -19C12 -18 17 -10 16 -2Z", `${cls} tint-ink`) +
      path("M-20 4C-22 16 -10 22 0 21C12 20 20 14 19 4Z", `${cls} tint-ink`) +
      path("M-36 1H36", "accent") +
      path("M-30 4V-2M-24 4V-2M24 4V-2M30 4V-2", "accent", { opacity: ".7" }),
  );
}

/** A small heart outline, for the tertiary stage of syphilis. */
export const heart = (x, y, s = 1, cls = "brand") =>
  at(
    x,
    y,
    path("M0 14C-14 4 -20 -4 -20 -10C-20 -18 -10 -22 0 -12C10 -22 20 -18 20 -10C20 -4 14 4 0 14Z", `${cls} tint-${cls}`) +
      path("M-4 -12C-4 -18 -2 -22 2 -24M4 -13C6 -18 10 -20 12 -20", cls),
    0,
    s,
  );

/** A brain seen from the side: two lobes and a few folds. */
export const brain = (x, y, s = 1, cls = "brand") =>
  at(
    x,
    y,
    path(
      "M-24 6C-30 -6 -24 -20 -10 -22C-4 -28 10 -28 16 -20C28 -18 32 -6 28 4C30 12 22 18 14 16C10 22 -2 22 -6 16C-16 20 -26 16 -24 6Z",
      `${cls} tint-${cls}`,
    ) + path("M-14 -10C-8 -14 -4 -6 2 -10S12 -14 16 -8M-18 4C-10 0 -6 8 2 4S14 2 20 6M0 -22C-2 -14 4 -12 2 -4", cls, { opacity: ".7" }),
    0,
    s,
  );

/**
 * A neuron cut flat: the cell body, tapered dendrites and the start of the axon, filled as one
 * shape, with its nucleus. The axon leaves to the right (or left, with dir -1).
 */
export function neuron(x, y, dir = 1, s = 1) {
  const soma =
    "M-16 -8C-22 -12 -30 -22 -38 -30C-30 -24 -20 -16 -12 -14C-10 -22 -8 -32 -2 -42C-4 -30 -4 -22 0 -16" +
    "C8 -16 14 -12 16 -4L30 -2V2L16 4C14 12 6 18 -2 18C-10 26 -20 32 -32 34C-22 28 -14 22 -12 14" +
    "C-18 10 -20 2 -16 -8Z";
  return at(
    x,
    y,
    g(path(soma, "muted tint-ink") + ellipse(-1, 0, 7, 6, "muted tint-ink"), {
      transform: `scale(${dir} 1)`,
    }),
    0,
    s,
  );
}

// The figure file

/**
 * The HTML file for one figure: the block, the figure with its accessible name, the SVG with
 * <title> and <desc>, and the sources line. The essay's caption lives in Carrel, not here.
 */
export function figure({ title, alt, width, height, body, sources }) {
  const credit = sources.map(([label, href]) => `<a href="${href}">${esc(label)}</a>`).join("; ");
  return `<div class="blog-diagram-block">
  <figure class="blog-diagram" role="img" aria-label="${alt.replace(/"/g, "&quot;")}">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
      <title>${esc(title)}</title>
      <desc>${esc(alt)}</desc>
      ${body}
    </svg>
  </figure>
  <p class="blog-diagram-credit">Sources: ${credit}.</p>
</div>
`;
}
