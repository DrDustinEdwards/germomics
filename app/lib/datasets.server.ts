// Curated datasets for the /data pages. Bundled JSON (served via loader data) rather than a
// D1 table — small, versioned with the code, and crawlable. getDataset() is the single read
// point, so moving these into an R2 "germomics-data" bucket later is a one-function change.
export type DataPoint = { lng: number; lat: number; label: string; value: number };
export type Series = { label: string; value: number };

export type Dataset = {
  slug: string;
  title: string;
  kind: "virus" | "bacteria";
  summary: string;
  unit: string;
  map: { center: [number, number]; zoom: number; points: DataPoint[] } | null;
  timeline: Series[] | null;
  table: { columns: string[]; rows: (string | number)[][] };
};

const DATASETS: Record<string, Dataset> = {
  "cholera-soho-1854": {
    slug: "cholera-soho-1854",
    title: "Cholera, Soho 1854",
    kind: "bacteria",
    summary:
      "John Snow's map of the Broad Street outbreak: deaths clustered around a single pump, the founding case of epidemiology and a Vibrio cholerae story.",
    unit: "deaths",
    map: {
      center: [-0.1367, 51.5132],
      zoom: 15.5,
      points: [
        { lng: -0.1366, lat: 51.5133, label: "Broad Street pump", value: 0 },
        { lng: -0.1372, lat: 51.5129, label: "Cambridge Street", value: 12 },
        { lng: -0.1359, lat: 51.5138, label: "Marshall Street", value: 9 },
        { lng: -0.1378, lat: 51.5141, label: "Poland Street", value: 7 },
      ],
    },
    timeline: [
      { label: "Aug 31", value: 56 },
      { label: "Sep 1", value: 143 },
      { label: "Sep 2", value: 116 },
      { label: "Sep 3", value: 54 },
      { label: "Sep 4", value: 46 },
      { label: "Sep 5", value: 36 },
    ],
    table: {
      columns: ["Location", "Deaths"],
      rows: [
        ["Cambridge Street", 12],
        ["Marshall Street", 9],
        ["Poland Street", 7],
        ["Broad Street pump", 0],
      ],
    },
  },
  "influenza-1918": {
    slug: "influenza-1918",
    title: "Influenza, 1918–1919",
    kind: "virus",
    summary:
      "The three waves of the 1918 H1N1 pandemic: mortality peaked sharply in the deadly autumn wave, a defining example of viral pandemic dynamics.",
    unit: "excess mortality (per 1,000)",
    map: null,
    timeline: [
      { label: "Spring '18", value: 1.2 },
      { label: "Summer '18", value: 0.8 },
      { label: "Autumn '18", value: 7.4 },
      { label: "Winter '19", value: 3.1 },
      { label: "Spring '19", value: 1.6 },
    ],
    table: {
      columns: ["Wave", "Excess mortality / 1,000"],
      rows: [
        ["Spring 1918", 1.2],
        ["Summer 1918", 0.8],
        ["Autumn 1918", 7.4],
        ["Winter 1919", 3.1],
        ["Spring 1919", 1.6],
      ],
    },
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
  return DATASETS[slug] ?? null;
}
