// Data previews on an episode page, outside the essay: one series the /data page already publishes (episode-context.server.ts).

type Citation = { label: string; href: string };

export type DataPreviewSpec = {
  id: string;
  dataset: "cholera-soho-1854" | "influenza-1918";
  /** The server requires its yLabel to be Deaths. */
  series: number;
  heading: string;
  /** The description a reader hears. */
  summary: string;
  link: string;
  sourceLabel: string;
};

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
  /** The visible sentences are the text alternative, so the SVG is hidden from assistive tech. */
  svg: string;
};

export type EpisodeContextView = {
  preview: DataPreviewView | null;
};
