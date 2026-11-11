// Data previews on an episode page, outside the essay. The essay stays in Carrel. A preview draws one
// series the /data page already publishes (app/lib/episode-context.server.ts, Enarratio). Mechanism
// figures are Prelum :::diagram blocks in the essay, and this file does not describe them.

type Citation = { label: string; href: string };

export type DataPreviewSpec = {
  id: string;
  /** A key of app/lib/data/datasets.json. */
  dataset: "cholera-soho-1854" | "influenza-1918";
  /** Which timeline in that dataset. The server requires its yLabel to be Deaths. */
  series: number;
  /** The preview's heading. */
  heading: string;
  /** One or two sentences under the line. This is the description a reader hears. */
  summary: string;
  /** The link to the data page. */
  link: string;
  /** A short credit. The address is still the series source. */
  sourceLabel: string;
};

/** Published episode slug to its data preview. Absent slugs get nothing. */
export const EPISODE_CONTEXT: Record<string, { preview: DataPreviewSpec }> = {
  // Confessions of a Cholera Girl. Snow's Table I, deaths column: peak 127 on 2 September 1854.
  "confessions-of-a-cholera-girl": {
    preview: {
      id: "cholera-deaths-preview",
      dataset: "cholera-soho-1854",
      series: 1,
      heading: "John Snow's own tally of cholera deaths around Broad Street",
      summary: "They peaked at 127 on September 2, then collapsed within ten days.",
      link: "See his map and the full numbers on the data page",
      sourceLabel: "John Snow, On the Mode of Communication of Cholera (1855)",
    },
  },
  // A Boy Named Flu. Registrar-General Table XX, civilian deaths: the high week is 2,651.
  "a-boy-named-flu": {
    preview: {
      id: "influenza-deaths-preview",
      dataset: "influenza-1918",
      series: 0,
      heading: "The Registrar-General's weekly count of influenza deaths in London",
      summary: "The worst week ended on November 2, 1918, with 2,651.",
      link: "See the three waves on the data page",
      sourceLabel: "Registrar-General's influenza report, 1920",
    },
  },
};

export type DataPreviewView = {
  id: string;
  heading: string;
  summary: string;
  link: string;
  source: Citation;
  href: string;
  /** Inline Enarratio sparkline. The visible sentences are the text alternative, so the SVG is hidden from assistive tech. */
  svg: string;
};

export type EpisodeContextView = {
  preview: DataPreviewView | null;
};
