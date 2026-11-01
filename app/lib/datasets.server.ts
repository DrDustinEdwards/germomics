// Curated datasets for the /data pages. Bundled JSON (served via loader data) rather than a
// D1 table — small, versioned with the code, and crawlable. getDataset() is the single read
// point, so moving these into an R2 "germomics-data" bucket later is a one-function change.
//
// THE NUMBERS are app/lib/data/datasets.json, each read from the source it cites; app/lib/data/SOURCES.md says what
// was fetched and how each was checked. This file adds only the page's words: titles, summaries, the chart's alt
// text and notes, each stating only what those numbers show.
import { SNIPPET_DEFAULTS } from "~/lib/content-defaults";
import data from "~/lib/data/datasets.json";

export type DataPoint = { lng: number; lat: number; label: string; value: number };
/** Where numbers come from, shown with a link beside the chart, map or table that uses them. */
export type Source = { label: string; url: string };
/** One line over dated points; `label` is how each date reads in the table and hover details. */
type TimelineSeries = { name: string; points: { date: string; label: string; value: number }[] };
/** A line chart over dated points, one line per series. */
export type Timeline = {
  title: string;
  alt: string;
  xLabel: string;
  yLabel: string;
  yUnit?: string;
  /** A sentence under the chart: what is left out of it, and why. */
  caption?: string;
  source: Source;
  series: TimelineSeries[];
};

/** A dot map (app/lib/charts.server.ts dataMap): points sized by count over Snow's streets, with landmarks. */
export type DataMap = {
  title: string;
  /** The finding: what the map shows, as its text alternative. */
  alt: string;
  points: DataPoint[];
  /** What a point's value counts, for the key, hover details and table. */
  valueLabel: string;
  landmarks: DataPoint[];
  /** What the landmarks are. */
  landmarkLabel: string;
  marked: string | null;
  /** How to read the map, under it. */
  legend: string;
  source: Source;
};

export type Dataset = {
  slug: string;
  title: string;
  kind: "virus" | "bacteria";
  summary: string;
  /** Points valued by count, and landmarks (value 0) drawn apart from them; `marked` is the landmark to pick out. */
  map: DataMap | null;
  timeline: Timeline | null;
  table: { title: string; columns: string[]; rows: (string | number)[][]; source: Source } | null;
  /** A note on the page, under the chart: how its counts relate to each other. */
  note: string | null;
};

const cholera = data["cholera-soho-1854"];
const influenza = data["influenza-1918"];
const [attacks, deaths] = cholera.timelines;
const [weeklyDeaths] = influenza.timelines;

const DATASETS: Record<string, Dataset> = {
  "cholera-soho-1854": {
    slug: "cholera-soho-1854",
    title: "Cholera, Soho 1854",
    kind: "bacteria",
    summary:
      "The deaths John Snow drew at each address on his 1855 map of the Broad Street outbreak, the 13 water pumps on that map, and the fatal attacks and deaths he counted each day.",
    map: {
      title: "Deaths by address, Soho, 1854, with the 13 water pumps on Snow's map",
      alt: "The deaths cluster round the Broad Street pump. 508 of the 578 are within 200 metres of it, and the address with the most deaths, 18, is 19 metres from it.",
      points: cholera.map.points,
      valueLabel: "Deaths",
      landmarks: cholera.pumps.points,
      landmarkLabel: "Water pump",
      marked: "Pump 7: Broad Street",
      legend: "Each dot is an address, its size the deaths Snow drew there (1 to 18). The squares are the 13 water pumps on his map; the filled one is the Broad Street pump.",
      source: cholera.map.source,
    },
    timeline: {
      title: "Fatal cholera attacks and deaths per day, Soho, 19 August to 30 September 1854",
      alt: "Fatal attacks were 8 or fewer a day until 31 August, when there were 56, and peaked at 143 on 1 September. Deaths peaked a day later, at 127 on 2 September. Both fell below 20 a day by 10 September.",
      xLabel: attacks.xLabel,
      yLabel: "Attacks and deaths",
      caption:
        "Snow's Table I also counts 45 fatal attacks whose date was unknown; they are not plotted. With them the attacks total 616, the same as the deaths, which are all dated.",
      source: attacks.source,
      series: [
        { name: attacks.yLabel, points: attacks.points },
        { name: deaths.yLabel, points: deaths.points },
      ],
    },
    table: {
      title: "Deaths on the map, by street",
      columns: cholera.table.columns,
      rows: cholera.table.rows,
      source: cholera.table.source,
    },
    note: "The map shows 578 deaths, the bars Snow drew at 321 addresses; his Table I counts 616 deaths by day. They are different counts in Snow's book, and each is shown as he gave it.",
  },
  "influenza-1918": {
    slug: "influenza-1918",
    title: "Influenza, London 1918 to 1919",
    kind: "virus",
    summary:
      "Civilian deaths from influenza in London each week from June 1918 to May 1919, from the Registrar-General's report of 1920: three waves, the second with more than twelve times the deaths of the first.",
    map: null,
    timeline: {
      title: weeklyDeaths.title,
      alt: weeklyDeaths.alt,
      xLabel: weeklyDeaths.xLabel,
      yLabel: weeklyDeaths.yLabel,
      source: weeklyDeaths.source,
      series: [{ name: weeklyDeaths.yLabel, points: weeklyDeaths.points }],
    },
    table: {
      title: "Deaths in each wave",
      columns: influenza.table.columns,
      rows: influenza.table.rows,
      source: influenza.table.source,
    },
    note: null,
  },
};

export function listDatasets(): Pick<Dataset, "slug" | "title" | "kind" | "summary">[] {
  return Object.values(DATASETS).map(({ slug, title, kind, summary }) => ({
    slug,
    title,
    kind,
    summary,
  }));
}

export function getDataset(slug: string): Dataset | null {
  return Object.hasOwn(DATASETS, slug) ? DATASETS[slug] : null;
}

/**
 * A dataset's summary as the page shows it. Carrel edits it as the D1 snippet `snippet:dataset.<slug>`, and an edit
 * there wins. A row that still holds the placeholder migration 0005 seeded (SNIPPET_DEFAULTS), or no row at all,
 * gives the summary above, written to state only what the numbers show.
 */
export function datasetSummary(snippets: Record<string, string>, slug: string, summary: string): string {
  const key = `snippet:dataset.${slug}`;
  const stored = snippets[key];
  return stored === undefined || stored === SNIPPET_DEFAULTS[key] ? summary : stored;
}
