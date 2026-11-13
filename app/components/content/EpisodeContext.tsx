// A data preview on an episode page, outside the essay: Capsomer's DataPreview card. Mechanism figures are :::diagram
// in the essay.
import { DataPreview } from "capsomer/react/chart-frame";
import { ExternalCue } from "~/components/ExternalCue";
import type { EpisodeContextView } from "~/lib/episode-context";
import "capsomer/chart-frame.css";

/** A data preview for one episode. Nothing, when the slug has none. */
export function EpisodeContext({ context }: { context: EpisodeContextView }) {
  const preview = context.preview;
  if (!preview) return null;
  return (
    <div className="gm-context-wrap">
      <DataPreview
        id={preview.id}
        level={2}
        heading={preview.heading}
        chart={preview.svg}
        summary={preview.summary}
        link={{ href: preview.href, label: preview.link }}
        source={{
          href: preview.source.href,
          label: (
            <>
              {preview.source.label}
              <ExternalCue />
            </>
          ),
        }}
      />
    </div>
  );
}
