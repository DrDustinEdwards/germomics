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
      "M81.1 75.5C81.0 75.0 81.0 74.4 81.1 74.2C81.2 73.4 79.9 73.6 77.8 74.7C73.7 76.8 69.0 73.3 72.3 70.7C75.9 67.9 77.4 67.5 85.5 67.6C91.8 67.6 92.9 67.5 91.1 67.0C89.8 66.6 88.4 66.0 88.0 65.7C83.5 62.0 69.4 59.7 64.8 62.0C63.0 63.0 59.5 64.5 57.1 65.4C53.0 66.9 49.7 68.8 47.6 70.9C45.6 72.8 34.7 75.2 33.8 73.9C33.5 73.6 32.1 73.3 30.5 73.3C27.2 73.3 25.8 72.3 27.0 70.8C27.6 70.0 27.4 69.7 25.8 69.2C23.6 68.4 23.1 66.6 24.9 66.0C25.5 65.8 26.7 65.4 27.4 65.0C28.1 64.7 30.3 64.3 32.3 64.2C38.1 63.9 40.2 61.4 41.1 54.2C41.9 48.2 31.8 40.0 23.6 40.0C18.0 40.0 13.9 39.2 10.2 37.5C8.8 36.8 6.7 35.8 5.7 35.3C3.3 34.2 0.0 29.5 0.0 27.2C0.0 25.3 1.0 24.1 5.4 20.9C7.1 19.7 8.4 18.4 8.1 18.1C7.9 17.7 8.0 17.6 8.5 17.8C9.2 18.3 14.8 14.6 14.8 13.6C14.8 13.3 15.1 12.8 15.4 12.5C15.8 12.2 15.9 12.3 15.6 12.8C15.0 13.7 16.2 14.0 16.8 13.0C17.0 12.7 19.8 11.5 23.1 10.3C28.1 8.5 29.1 7.9 29.5 6.5C30.2 3.5 32.4 0.4 34.2 0.0C36.0 -0.5 38.0 0.5 37.8 1.8C37.7 2.2 37.9 3.5 38.4 4.7L39.1 6.9L40.8 5.3C44.6 1.9 50.2 2.9 51.3 7.2C52.6 12.1 58.9 12.7 68.3 9.0C86.4 1.7 103.5 2.7 116.9 11.6C118.4 12.7 120.0 13.4 120.3 13.2C120.6 13.0 120.7 13.1 120.6 13.4C120.3 14.8 126.9 20.2 128.4 19.8C130.1 19.4 130.8 21.8 129.2 22.4C128.5 22.6 128.5 22.9 129.2 23.6C129.8 24.2 130.0 29.5 130.0 45.1L130.0 65.8L126.3 67.5C122.8 69.1 122.1 69.2 116.4 68.8L110.3 68.4L110.1 70.2C109.8 72.5 102.4 74.3 93.0 74.3C88.9 74.4 86.2 74.7 85.1 75.3C83.1 76.5 81.2 76.6 81.1 75.5Z",
      "muted tint2-ink",
    ) +
    // the ear's inner fold, the eye and the whiskers, drawn over the traced body
    circle(23, 17, 2.2, "muted", { style: "fill: var(--muted)" }) +
    path("M4 24C-2 21 -7 19 -11 19M4 27C-2 28 -7 30 -10 32", "muted", { opacity: ".6" }) +
    // the tail: it leaves the rump low and sweeps back and up, as in the reference
    path("M131 49C158 46 180 52 192 66C196 71 198 76 198 80", "muted", {
      style: "stroke-width: 2.6; stroke-linecap: round; fill: none",
    });
  return at(x, y, g(at(-80, -38, shape, 0, 1), { transform: `scale(${dir} 1)` }), 0, s);
}

/**
 * A kidney cut lengthwise: cortex, medulla with pyramids, pelvis and ureter. With detail false it
 * is the bean and the pelvis alone, for the sizes where the pyramids turn into noise.
 */
export function kidney(x, y, s = 1, cls = "brand", { detail = true } = {}) {
  const inner =
    path(
      "M10 -44C34 -44 46 -20 44 4C42 30 26 46 6 44C-12 42 -14 28 -8 18C-4 12 -4 -10 -8 -16C-16 -30 -10 -44 10 -44Z",
      `${cls} tint-${cls}`,
    ) +
    (detail
      ? path("M12 -34C28 -32 36 -14 34 4C32 22 22 34 8 34", cls, {
          opacity: ".7",
          "stroke-dasharray": "2 3",
        }) + path("M16 -22L26 -12L14 -6ZM18 2L30 4L18 12ZM14 22L24 28L10 30Z", `${cls} tint2-${cls}`)
      : "") +
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

/**
 * A person as a bust seen from the front: head, neck, shoulders and chest. The silhouette and the
 * hair are traced from the reference drawing with scripts/figures/trace.py and restyled flat, so
 * the proportions are a real body's and not a stick figure's. 92 x 121 at s = 1, head top on y 0.
 */
export function bust(x, y, s = 1) {
  const body =
    "M21.1 115.8C20.9 115.5 20.8 114.1 20.7 112.5C20.7 111.0 20.3 107.9 19.9 105.7C19.4 103.6 18.8 100.7 18.7 99.4L18.4 97.0L16.6 101.1C15.6 103.3 14.2 107.1 13.5 109.4C11.7 115.4 11.1 116.1 9.3 114.5C8.6 113.8 7.8 113.5 7.7 113.7C7.5 114.0 6.1 114.1 4.5 113.9C2.9 113.7 1.5 113.7 1.3 114.0C-1.3 118.3 -0.1 102.8 3.4 89.2C4.0 86.9 4.7 83.1 5.1 80.8C7.0 67.5 9.6 64.2 21.2 60.1C30.6 56.8 32.9 55.2 33.4 52.0C33.8 49.1 33.7 48.9 29.2 41.6C22.2 30.0 23.4 13.4 31.5 10.1C32.5 9.7 33.8 8.8 34.6 8.1C38.0 4.9 46.2 5.1 53.2 8.5L56.9 10.4L57.1 25.7C57.2 35.6 57.0 41.4 56.6 42.1C56.3 42.8 56.2 43.2 56.6 43.2C56.9 43.2 57.2 43.8 57.1 44.6C57.0 45.3 56.8 45.8 56.5 45.6C56.3 45.5 56.2 45.1 56.4 44.9C57.3 43.4 55.0 44.2 54.0 45.8C51.5 49.4 52.7 55.3 56.1 56.4C57.2 56.7 57.2 57.3 57.2 65.7L57.2 74.6L68.6 74.7L79.9 74.9L80.4 77.4C80.6 78.8 81.4 82.2 82.0 85.0C82.6 87.8 83.8 93.4 84.7 97.6C85.7 102.4 86.9 106.4 88.0 108.5C88.9 110.4 89.9 112.6 90.3 113.4C91.1 115.7 89.9 116.0 89.0 113.8C88.5 112.6 88.1 112.3 88.1 112.9C88.1 113.8 87.5 113.9 82.4 113.8C77.7 113.8 76.7 113.9 76.1 114.7C75.1 116.1 74.4 115.1 72.9 110.0C72.3 107.7 70.9 104.0 69.9 101.7L68.1 97.6L66.9 103.4C66.2 106.6 65.6 110.2 65.6 111.5C65.6 114.1 65.2 115.6 64.4 115.6C64.1 115.6 64.0 115.2 64.1 114.7C64.4 114.0 61.9 113.9 44.3 114.1C29.5 114.3 24.1 114.2 23.9 113.7C23.8 113.3 23.6 113.5 23.6 114.1C23.6 114.6 23.3 114.9 23.0 114.7C22.7 114.6 22.3 114.8 22.0 115.3C21.8 115.8 21.4 116.0 21.1 115.8Z";
  const hair =
    "M30.2 41.9C22.8 29.9 23.6 14.4 31.7 10.6C32.9 10.0 34.8 8.9 35.7 8.2C40.2 4.9 50.8 6.4 55.8 11.0C57.1 12.2 57.1 12.5 57.1 21.1C57.2 28.0 56.8 32.6 56.3 31.0C55.6 28.6 55.5 26.2 55.4 26.0C55.1 25.7 44.6 32.7 44.1 33.6C43.9 33.8 46.0 35.7 48.7 37.6C52.9 40.7 54.2 41.3 54.9 40.6C55.4 40.1 55.2 41.0 54.5 42.7L53.3 44.3C51.6 46.7 51.9 47.1 53.8 44.9C54.8 43.6 55.5 43.2 55.8 43.7L54.5 42.7L48.6 38.3C45.3 36.0 42.8 33.8 42.9 33.6C43.1 33.4 45.7 31.4 48.8 29.2C55.3 24.6 55.2 24.9 51.9 22.2C49.2 20.0 48.7 19.8 49.2 21.0C49.3 21.5 49.4 21.9 49.3 21.9C48.2 21.9 38.7 18.3 37.5 17.4C35.5 15.9 35.5 15.9 34.8 18.3C34.4 19.4 33.4 21.1 32.5 22.1C30.9 23.9 29.8 27.2 29.7 30.0L29.7 31.7L28.9 29.9C27.9 27.7 27.6 27.6 26.9 29.5C26.2 31.4 27.7 36.7 29.3 37.8C30.0 38.3 30.8 39.8 31.3 41.1C31.7 42.4 32.5 43.9 32.9 44.4C33.4 44.9 33.7 45.8 33.6 46.3C33.5 46.8 32.1 45.1 30.2 41.9Z";
  return at(
    x,
    y,
    path(body, "muted tint-ink") +
      path(hair, "muted", { style: "fill: var(--muted); fill-opacity: .55" }),
    0,
    s,
  );
}

/**
 * A pool of fresh water over wet soil, seen from above and in front as the reference draws it: one
 * traced outline, the water side an accent tint with ripples, the soil side an ink tint with
 * grains. 170 x 59 at s = 1, centred on the point it is given. The clip id must be unique.
 */
export function pool(x, y, id, s = 1) {
  const outline =
    "M45.4 51.3C15.7 44.7 -0.0 33.9 0.0 19.9C0.1 -14.0 103.7 -27.8 150.0 0.0C178.1 16.9 165.2 40.1 121.7 50.8L115.9 52.2L83.5 52.4C51.3 52.5 51.0 52.5 45.4 51.3Z";
  const soil =
    // the shoreline, following the reference: the soil takes the right third, the line running
    // from the back edge down and to the left before turning out to the rim.
    "M96 -12C92 2 104 8 100 20C96 32 84 38 88 54H160V-14Z";
  return at(
    x,
    y,
    `<clipPath id="${id}"><path d="${outline}" /></clipPath>` +
      at(
        -75,
        -26,
        path(outline, "accent tint-accent") +
          g(path(soil, "muted tint-ink"), { "clip-path": `url(#${id})` }) +
          path("M96 -12C92 2 104 8 100 20C96 32 84 38 88 54", "muted") +
          // ripples on the water side, as rings so they do not read as bacteria
          path(
            "M22 26a20 7 0 0 0 40 0M28 20a14 5 0 0 0 28 0M16 34a26 9 0 0 0 52 0",
            "accent",
            { style: "fill: none", opacity: ".55" },
          ) +
          // grains on the soil side
          [
            [112, 10],
            [128, 4],
            [138, 18],
            [120, 26],
            [146, 32],
            [108, 34],
            [130, 40],
          ]
            .map(([gx, gy], i) => circle(gx, gy, 1.4 + (i % 2) * 0.6, "muted", { style: "fill: var(--muted); fill-opacity: .45" }))
            .join("") +
          path(outline, "accent", { style: "fill: none" }),
      ),
    0,
    s,
  );
}
