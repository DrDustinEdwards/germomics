// Compact context on an episode page: a data preview, a schematic, or both. Rendered beside the essay,
// not inside its stored HTML. Styles use the site's tokens (app/app.css).
import { Link } from "capsomer/react/link";
import { ExternalCue } from "~/components/ExternalCue";
import type {
  Citation,
  DataPreviewView,
  EpisodeContextView,
  Schematic,
} from "~/lib/episode-context";

function SourceLine({ sources }: { sources: Citation[] }) {
  return (
    <p className="mt-3 font-display text-xs leading-relaxed text-muted">
      Sources:{" "}
      {sources.map((source, i) => (
        <span key={source.href}>
          {i > 0 ? "; " : null}
          <a href={source.href} className="text-accent underline underline-offset-2">
            {source.label}
            <ExternalCue />
          </a>
        </span>
      ))}
    </p>
  );
}

function DataPreview({ preview }: { preview: DataPreviewView }) {
  return (
    <figure id={preview.id} className="rounded-xl border border-border bg-card p-4">
      <figcaption>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Data</p>
        <p className="mt-1 font-display text-lg font-semibold leading-snug text-ink">
          {preview.title}
        </p>
      </figcaption>
      <div
        className="mt-3 [--enarratio-series-1:var(--brand)] forced-colors:[--enarratio-series-1:CanvasText] [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: preview.svg }}
      />
      <p className="mt-3 text-sm leading-relaxed text-ink">{preview.alt}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{preview.limits}</p>
      <p className="mt-3 text-sm">
        <Link to={preview.href} className="font-display text-accent underline underline-offset-2">
          The full data page
        </Link>
      </p>
      <p className="mt-2 font-display text-xs leading-relaxed text-muted">
        Source:{" "}
        <a href={preview.source.href} className="text-accent underline underline-offset-2">
          {preview.source.label}
          <ExternalCue />
        </a>
      </p>
    </figure>
  );
}

function SchematicFigure({ schematic }: { schematic: Schematic }) {
  return (
    <figure id={schematic.id} className="rounded-xl border border-border bg-card p-4">
      <figcaption>
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Schematic</p>
        <p className="mt-1 font-display text-lg font-semibold leading-snug text-ink">
          {schematic.title}
        </p>
      </figcaption>
      <ol className="mt-4 space-y-3 border-l-2 border-brand pl-4">
        {schematic.steps.map((step, index) => (
          <li key={step.label} className="grid grid-cols-[1.5rem_1fr] gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand font-mono text-xs text-on-brand"
            >
              {index + 1}
            </span>
            <span>
              <span className="font-display text-sm font-semibold text-ink">{step.label}</span>
              <span className="mt-0.5 block text-sm leading-snug text-muted">{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm leading-relaxed text-ink">{schematic.caption}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{schematic.limits}</p>
      {schematic.links.length ? (
        <p className="mt-3 text-sm leading-relaxed">
          {schematic.links.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="text-accent underline underline-offset-2"
            >
              {link.text}
            </Link>
          ))}
        </p>
      ) : null}
      <SourceLine sources={schematic.sources} />
    </figure>
  );
}

/** Context for one episode. Nothing, when the slug has no preview and no schematic. */
export function EpisodeContext({ context }: { context: EpisodeContextView }) {
  if (!context.preview && !context.schematic) return null;
  return (
    <div className="mb-10 grid gap-4">
      {context.preview ? <DataPreview preview={context.preview} /> : null}
      {context.schematic ? <SchematicFigure schematic={context.schematic} /> : null}
    </div>
  );
}
