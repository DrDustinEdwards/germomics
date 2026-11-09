// Data previews on an episode page, outside the essay. The essay stays in Carrel. A preview draws one
// series the /data page already publishes (app/lib/episode-context.server.ts, Enarratio). Mechanism
// figures are Prelum :::diagram blocks in the essay, proposed in app/lib/episode-diagrams.ts, not drawn here.

export type Citation = { label: string; href: string };

export type DataPreviewSpec = {
  id: string;
  /** A key of app/lib/data/datasets.json. */
  dataset: "cholera-soho-1854" | "influenza-1918";
  /** Which timeline in that dataset. The server requires its yLabel to be Deaths. */
  series: number;
  /** What this drawing is not. The dataset's own note, when it has one, is placed before this. */
  limits: string;
};

/** Published episode slug to its data preview. Absent slugs get nothing. */
export const EPISODE_CONTEXT: Record<string, { preview: DataPreviewSpec }> = {
  // Confessions of a Cholera Girl
  "confessions-of-a-cholera-girl": {
    preview: {
      id: "cholera-deaths-preview",
      dataset: "cholera-soho-1854",
      series: 1,
      limits:
        "The line above is only the daily deaths in that table. It is not the map, and it is not evidence that the Broad Street pump caused the deaths. The map and the street table stay on the data page.",
    },
  },
  // A Boy Named Flu
  "a-boy-named-flu": {
    preview: {
      id: "influenza-deaths-preview",
      dataset: "influenza-1918",
      series: 0,
      limits:
        "The line is deaths certified to influenza, not cases. It does not show how easily each wave spread, or how hard the illness was for each person who had it. The dated chart and the wave table stay on the data page.",
    },
  },
};

export type DataPreviewView = {
  id: string;
  title: string;
  /** The checked description of the series this line draws. */
  alt: string;
  limits: string;
  source: Citation;
  href: string;
  /** Inline Enarratio sparkline. The visible sentences are the text alternative, so the SVG is hidden from assistive tech. */
  svg: string;
};

export type EpisodeContextView = {
  preview: DataPreviewView | null;
};
