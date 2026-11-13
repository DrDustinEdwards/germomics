// A data preview on an episode page, outside the essay. Mechanism figures are :::diagram in the essay.
import { Link } from "capsomer/react/link";
import { ExternalCue } from "~/components/ExternalCue";
import type { DataPreviewView, EpisodeContextView } from "~/lib/episode-context";
import { markup } from "capsomer/behavior/trusted-html";

function DataPreview({ preview }: { preview: DataPreviewView }) {
  return (
    <figure id={preview.id} className="gm-context">
      <figcaption>
        <p className="gm-context-title">{preview.heading}</p>
      </figcaption>
      <div
        className="gm-context-chart"
        aria-hidden="true"
        dangerouslySetInnerHTML={markup(preview.svg)}
      />
      <p className="gm-context-summary">{preview.summary}</p>
      <p className="gm-context-more">
        <Link to={preview.href} className="gm-context-link">
          {preview.link}
        </Link>
      </p>
      <p className="gm-context-source">
        <a href={preview.source.href} className="gm-context-source-link">
          {preview.source.label}
          <ExternalCue />
        </a>
      </p>
    </figure>
  );
}

/** A data preview for one episode. Nothing, when the slug has none. */
export function EpisodeContext({ context }: { context: EpisodeContextView }) {
  if (!context.preview) return null;
  return (
    <div className="gm-context-wrap">
      <DataPreview preview={context.preview} />
    </div>
  );
}
