// The /data charts, drawn on the server by Enarratio (nothing reaches the client chunk). Look: capsomer/enarratio.css with app/charts.css tokens; the charts island swaps in the narrow drawing on a phone.
import { frameHtml, narrowRedraw } from "capsomer/behavior/chart-frame";
import { type LineChartOptions, lineChart } from "enarratio/lite/line";
import { type DotMapOptions, dotMap, type GeoFeatureCollection } from "enarratio/map";
import type { DataMap } from "~/lib/datasets.server";
import type { Timeline } from "~/lib/datasets.server";
import streets from "~/lib/data/soho-streets.json";

function drawingOf(html: string): string {
  const start = html.indexOf('<div class="enarratio-frame');
  const end = html.indexOf("</svg></div>", start);
  if (start === -1 || end === -1) throw new Error("no drawing in Enarratio's output");
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
  const wide = lineChart(options);
  return frameHtml(wide, {
    redraw: narrowRedraw(wide, (width, fit) => drawingOf(lineChart({ ...options, width, ...fit }))),
  });
}

/** Snow's streets (SOURCES.md, scripts/soho-streets.py). A roman numeral in a name only parts table rows, so the printed name drops it. */
const SOHO_STREETS: GeoFeatureCollection = {
  ...(streets as GeoFeatureCollection),
  features: (streets as GeoFeatureCollection).features.map((f) => ({
    ...f,
    properties: { name: String(f.properties?.name ?? "").replace(/ \([IVX]+\)$/, "") },
  })),
};

/** A /data map, drawn on the server by Enarratio's dotMap (design record 0028). */
export function dataMap(slug: string, m: DataMap): string {
  const options = {
    id: `${slug}-map`,
    data: m.points,
    longitude: "lng",
    latitude: "lat",
    value: "value",
    label: "label",
    labelHeader: "Street",
    valueLabel: m.valueLabel,
    basemap: [{ geometry: SOHO_STREETS, labels: "name" }],
    landmarks: m.landmarks.map((l) => ({
      name: l.label,
      longitude: l.lng,
      latitude: l.lat,
      highlight: l.label === m.marked,
    })),
    landmarkLabel: m.landmarkLabel,
    caption: m.legend,
    source: { name: m.source.label, href: m.source.url },
    title: m.title,
    alt: m.alt,
  } satisfies DotMapOptions<(typeof m.points)[number]>;
  // A map keeps its shape, so its phone drawing is far shorter (about 340px against 615px at 30rem): keepShape scales the wide map to those proportions until the swap, so the swap does not move the page (D5).
  const wide = dotMap(options);
  const redraw = narrowRedraw(wide, (width) => drawingOf(dotMap({ ...options, width })), {
    keepShape: true,
  });
  return frameHtml(wide, { redraw, keepShape: true });
}
