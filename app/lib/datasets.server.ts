// Curated datasets for the /data pages. Bundled JSON (served via loader data) rather than a
// D1 table — small, versioned with the code, and crawlable. getDataset() is the single read
// point, so moving these into an R2 "germomics-data" bucket later is a one-function change.
export type DataPoint = { lng: number; lat: number; label: string; value: number };
/** A line chart over dated points; `label` is how each date reads in the table and hover details. */
export type Timeline = {
  title: string;
  alt: string;
  xLabel: string;
  yLabel: string;
  yUnit?: string;
  points: { date: string; label: string; value: number }[];
};

export type Dataset = {
  slug: string;
  title: string;
  kind: "virus" | "bacteria";
  summary: string;
  map: { center: [number, number]; zoom: number; points: DataPoint[] } | null;
  timeline: Timeline | null;
  table: { columns: string[]; rows: (string | number)[][] } | null;
};

const DATASETS: Record<string, Dataset> = {
  "cholera-soho-1854": {
    slug: "cholera-soho-1854",
    title: "Cholera, Soho 1854",
    kind: "bacteria",
    summary:
      "John Snow's map of the Broad Street outbreak: deaths clustered around a single pump, the founding case of epidemiology and a Vibrio cholerae story.",
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
    timeline: {
      title: "Cholera deaths per day, Soho, 1854",
      alt: "Deaths peaked at 143 on 1 September 1854, the day after the outbreak began, and fell to 36 by 5 September.",
      xLabel: "Day",
      yLabel: "Deaths",
      points: [
        { date: "1854-08-31", label: "31 August", value: 56 },
        { date: "1854-09-01", label: "1 September", value: 143 },
        { date: "1854-09-02", label: "2 September", value: 116 },
        { date: "1854-09-03", label: "3 September", value: 54 },
        { date: "1854-09-04", label: "4 September", value: 46 },
        { date: "1854-09-05", label: "5 September", value: 36 },
      ],
    },
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
    title: "Influenza, 1918-1919",
    kind: "virus",
    summary:
      "The three waves of the 1918 H1N1 pandemic: mortality peaked sharply in the deadly autumn wave, a defining example of viral pandemic dynamics.",
    map: null,
    // Each season sits at its middle month on the time axis.
    timeline: {
      title: "Excess mortality by season, 1918 to 1919",
      alt: "Excess mortality peaked at 7.4 per 1,000 in autumn 1918, about six times the spring 1918 wave, and fell to 1.6 by spring 1919.",
      xLabel: "Season",
      yLabel: "Excess mortality",
      yUnit: "per 1,000",
      points: [
        { date: "1918-04-01", label: "Spring 1918", value: 1.2 },
        { date: "1918-07-01", label: "Summer 1918", value: 0.8 },
        { date: "1918-10-01", label: "Autumn 1918", value: 7.4 },
        { date: "1919-01-01", label: "Winter 1919", value: 3.1 },
        { date: "1919-04-01", label: "Spring 1919", value: 1.6 },
      ],
    },
    table: null,
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
