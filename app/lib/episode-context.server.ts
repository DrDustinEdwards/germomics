// Builds the episode-page context (app/lib/episode-context.ts). The sparkline is Enarratio's, from the same
// bundled series the /data page charts. The map is not drawn here.
import { sparkline } from "enarratio";
import data from "~/lib/data/datasets.json";
import { getDataset } from "~/lib/datasets.server";
import {
  EPISODE_CONTEXT,
  type DataPreviewView,
  type EpisodeContextView,
} from "~/lib/episode-context";

type Series = {
  title: string;
  alt: string;
  yLabel: string;
  points: { value: number }[];
  source: { label: string; url: string };
};

const bundle = data as unknown as Record<string, { timelines: Series[] }>;

function previewOf(
  spec: NonNullable<(typeof EPISODE_CONTEXT)[string]["preview"]>,
): DataPreviewView {
  const dataset = getDataset(spec.dataset);
  const series = bundle[spec.dataset]?.timelines[spec.series];
  if (!dataset || !series) throw new Error(`episode context: no series for ${spec.dataset}`);
  // A reordered file must not silently draw attacks, or the death rate, under a deaths caption.
  if (series.yLabel !== "Deaths")
    throw new Error(`episode context: ${spec.dataset} series ${spec.series} is ${series.yLabel}`);
  const svg = sparkline({
    values: series.points.map((p) => p.value),
    inline: true,
    width: 480,
    height: 84,
    alt: series.alt,
    endDot: true,
  });
  return {
    id: spec.id,
    title: series.title,
    alt: series.alt,
    limits: [dataset.note, spec.limits].filter(Boolean).join(" "),
    source: { label: series.source.label, href: series.source.url },
    href: `/data/${spec.dataset}`,
    svg,
  };
}

/** The context for one episode slug, or null when this page has none. */
export function episodeContext(slug: string): EpisodeContextView | null {
  const spec = EPISODE_CONTEXT[slug];
  if (!spec) return null;
  return {
    preview: spec.preview ? previewOf(spec.preview) : null,
    schematic: spec.schematic ?? null,
  };
}
