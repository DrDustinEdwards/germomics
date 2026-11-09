// A data preview on an episode page, outside the essay. Mechanism figures are :::diagram in the essay.
import { Link } from "capsomer/react/link";
import { ExternalCue } from "~/components/ExternalCue";
import type { DataPreviewView, EpisodeContextView } from "~/lib/episode-context";

function DataPreview({ preview }: { preview: DataPreviewView }) {
  return (
    <figure id={preview.id} className="rounded-xl border border-border bg-card p-4">
      <figcaption>
        <p className="font-display text-lg font-semibold leading-snug text-ink">
          {preview.heading}
        </p>
      </figcaption>
      <div
        className="mt-3 [--enarratio-series-1:var(--brand)] forced-colors:[--enarratio-series-1:CanvasText] [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: preview.svg }}
      />
      <p className="mt-3 text-sm leading-relaxed text-ink">{preview.summary}</p>
      <p className="mt-3 text-sm">
        <Link to={preview.href} className="font-display text-accent underline underline-offset-2">
          {preview.link}
        </Link>
      </p>
      <p className="mt-2 font-display text-xs leading-relaxed text-muted">
        <a href={preview.source.href} className="text-accent underline underline-offset-2">
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
    <div className="mb-10">
      <DataPreview preview={context.preview} />
    </div>
  );
}
