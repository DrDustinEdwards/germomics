// Curated /data datasets: bundled JSON, versioned with the code. The numbers are app/lib/data/datasets.json, each read
// from its cited source (SOURCES.md says how each was checked). This file adds only the page's words, each stating
// only what those numbers show.
import data from "~/lib/data/datasets.json";

type DataPoint = { lng: number; lat: number; label: string; value: number };
export type Source = { label: string; url: string };
/** `label` is how each date reads in the table and hover details. */
type TimelineSeries = { name: string; points: { date: string; label: string; value: number }[] };
export type Timeline = {
  title: string;
  alt: string;
  xLabel: string;
  yLabel: string;
  yUnit?: string;
  caption?: string;
  source: Source;
  series: TimelineSeries[];
};

export type DataMap = {
  title: string;
  alt: string;
  points: DataPoint[];
  valueLabel: string;
  landmarks: DataPoint[];
  landmarkLabel: string;
  marked: string | null;
  legend: string;
  source: Source;
};

export type Dataset = {
  slug: string;
  title: string;
  kind: "virus" | "bacteria";
  summary: string;
  /** Landmarks have value 0; `marked` is the one to pick out. */
  map: DataMap | null;
  timeline: Timeline | null;
  table: { title: string; columns: string[]; rows: (string | number)[][]; source: Source } | null;
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
      alt: "The deaths cluster around the Broad Street pump. 508 of the 578 are within 200 meters of it, and the address with the most deaths, 18, is 19 meters from it.",
      points: cholera.map.points,
      valueLabel: "Deaths",
      landmarks: cholera.pumps.points,
      landmarkLabel: "Water pump",
      marked: "Pump 7: Broad Street",
      legend:
        "Each dot is an address, its size the deaths Snow drew there (1 to 18). The squares are the 13 water pumps on his map; the filled one is the Broad Street pump.",
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
