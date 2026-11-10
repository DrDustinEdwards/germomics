# Figure style

Episode figures are inline SVG in `public/blog-diagrams`, one file per figure, drawn in one hairline style.

- **Lines.** 1.25 px strokes that do not scale (`.ln`). Fills are light tints only (`.tint-brand`, `.tint-accent`). Flat 2D, no gradients or shadows.
- **Color.** Theme tokens only: `--ink` for structure, `--brand` for the main actor, `--accent` for the contrasting one, `--muted` for arrows and guides. Meaning never rests on color alone. Every contrast pair clears 3:1 (WCAG 1.4.11).
- **Text.** Primary labels 14 px, secondary labels 12 px, at most two lines. Each figure has a `<title>`, a `<desc>` that names every part, and a caption with sources.
- **Motion.** CSS only, scroll-driven (`animation-timeline: view()`), inside `@supports` and `prefers-reduced-motion: no-preference`, off in print. Classes: `.m-fade`, `.m-draw`, `.m-slide`, staggered with `--i`. Nothing moves in the static page, so no information depends on motion (WCAG 2.2.2).
- **Numbers.** A figure shows a number only if its source is cited in the caption. Otherwise it is a schematic and says so.
- **Several per episode.** A diagram entry in `app/lib/episode-diagrams.ts` names its `file`; its Mermaid stub must be unique, because its hash picks the drawing.
