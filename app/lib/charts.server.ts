// The /data charts, drawn on the server by Enarratio in Capsomer's chart frame (nothing reaches the shared client
// chunk, hard rule 4). Their look is capsomer/enarratio.css with germomics' tokens mapped in (app/charts.css); the
// charts island (app/islands/charts.ts) enhances them and swaps in the narrow drawing on a phone.
import { frameHtml } from "capsomer/behavior/chart-frame";
import { type LineChartOptions, lineChart } from "enarratio/lite/line";
import type { Timeline } from "~/lib/datasets.server";

/**
 * The phone drawing's width: a 320 px screen leaves the frame about 262 px, so its text stays near 12 px. A full
 * redraw spec (`{ chart: "line", options }`) would fit every width, but it travels as JSON and would lose formatX,
 * which names each point by its label ("Autumn 1918") in the hover details.
 */
const NARROW_WIDTH = 280;

/** The `.enarratio-frame` (the drawing alone) of a chart's markup, what enarratio/redraw swaps in. */
function drawingOf(html: string): string {
  const start = html.indexOf('<div class="enarratio-frame');
  const end = html.indexOf("</svg></div>", start);
  if (start === -1 || end === -1) throw new Error("timelineChart: no drawing in Enarratio's output");
  return html.slice(start, end + "</svg></div>".length);
}

export function timelineChart(slug: string, t: Timeline): string {
  const several = t.series.length > 1;
  const data = t.series.flatMap((s) => s.points.map((p) => ({ ...p, series: s.name })));
  const labels = new Map(data.map((p) => [Date.parse(p.date), p.label]));
  const options = {
    id: `${slug}-timeline`,
    data,
    x: "date",
    y: "value",
    ...(several ? { series: "series" as const } : {}),
    xLabel: t.xLabel,
    yLabel: t.yLabel,
    ...(t.yUnit ? { yUnit: t.yUnit } : {}),
    ...(t.caption ? { caption: t.caption } : {}),
    source: { name: t.source.label, href: t.source.url },
    title: t.title,
    alt: t.alt,
    formatX: (v: number | Date) => labels.get(Number(v)) ?? String(v),
  } satisfies LineChartOptions<(typeof data)[number]>;
  return frameHtml(lineChart(options), { redraw: { narrow: drawingOf(lineChart({ ...options, width: NARROW_WIDTH })) } });
}
