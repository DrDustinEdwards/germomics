// The /data charts, drawn on the server by Enarratio (nothing reaches the client, hard rule 4), themed
// from app.css's tokens (card, ink, muted, border, accent, brand); other series slots pass checkTheme.
import { stylesheet } from "enarratio";
import { lineChart } from "enarratio/lite/line";
import { defaultTheme } from "enarratio/themes";
import type { Timeline } from "~/lib/datasets.server";

const light = defaultTheme.light.series;
const dark = defaultTheme.dark.series;

export const chartStylesheet = stylesheet({
  name: "germomics",
  fonts: { body: '"Space Grotesk", ui-sans-serif, system-ui, sans-serif' },
  gridlines: "y",
  light: {
    ...defaultTheme.light,
    background: "#ffffff",
    text: "#14101f",
    mutedText: "#6b6577",
    grid: "#e2dcec",
    focus: "#0e7490",
    series: ["#4f2d7f", light[1], light[2], light[3], light[6], "#325d56", "#0b4fd5", "#242442"],
  },
  dark: {
    ...defaultTheme.dark,
    background: "#181125",
    text: "#edeaf5",
    mutedText: "#9a8fb0",
    grid: "#2c2440",
    focus: "#22d3ee",
    series: ["#c4aef0", dark[1], dark[2], dark[3], dark[6], "#6aafa3", "#256af4", "#8b8bc1"],
  },
});

export function timelineChart(slug: string, t: Timeline): string {
  const labels = new Map(t.points.map((p) => [Date.parse(p.date), p.label]));
  return lineChart({
    id: `${slug}-timeline`,
    data: t.points,
    x: "date",
    y: "value",
    xLabel: t.xLabel,
    yLabel: t.yLabel,
    ...(t.yUnit ? { yUnit: t.yUnit } : {}),
    title: t.title,
    alt: t.alt,
    formatX: (v) => labels.get(Number(v)) ?? String(v),
  });
}
