// SEO panel (§G): SEO title + description with char counters, a Google-snippet preview, and an
// Open Graph / Twitter card preview using the post's effective social image. Canonical URL shown.
import { Field, inputCx } from "./ui";

export function SeoPanel({
  slug,
  origin,
  seoTitle,
  seoDescription,
  fallbackTitle,
  fallbackDescription,
  image,
  imageAlt,
  onChange,
}: {
  slug: string;
  origin: string;
  seoTitle: string;
  seoDescription: string;
  fallbackTitle: string;
  fallbackDescription: string;
  image: string | null;
  imageAlt: string | null;
  onChange: (patch: { seoTitle?: string; seoDescription?: string }) => void;
}) {
  const title = (seoTitle || fallbackTitle || "Untitled").trim();
  const desc = (seoDescription || fallbackDescription || "").trim();
  const canonical = `${origin}/${slug}`;
  const host = origin.replace(/^https?:\/\//, "");

  return (
    <div className="space-y-4">
      <Field label="SEO title" hint="Recommended ≤ 60 characters." count={{ value: seoTitle.length, max: 60 }}>
        {({ id, describedBy }) => (
          <input
            id={id}
            aria-describedby={describedBy}
            value={seoTitle}
            placeholder={fallbackTitle}
            className={inputCx}
            onChange={(e) => onChange({ seoTitle: e.target.value })}
          />
        )}
      </Field>

      <Field
        label="SEO description"
        hint="Recommended ≤ 155 characters."
        count={{ value: seoDescription.length, max: 155 }}
      >
        {({ id, describedBy }) => (
          <textarea
            id={id}
            aria-describedby={describedBy}
            value={seoDescription}
            rows={3}
            placeholder={fallbackDescription}
            className={inputCx}
            onChange={(e) => onChange({ seoDescription: e.target.value })}
          />
        )}
      </Field>

      <div>
        <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-muted">Google preview</p>
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="truncate font-mono text-[11px] text-muted">{host}/{slug}</p>
          <p className="truncate text-[15px] text-[#1a0dab] dark:text-[#8ab4f8]">{title}</p>
          <p className="line-clamp-2 text-sm text-muted">{desc || "Add an SEO description to control this snippet."}</p>
        </div>
      </div>

      <div>
        <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-muted">Social card</p>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {image ? (
            <img src={image} alt={imageAlt || ""} className="aspect-[1.91/1] w-full object-cover" />
          ) : (
            <div className="grid aspect-[1.91/1] w-full place-items-center bg-surface text-xs text-muted">
              No social image set
            </div>
          )}
          <div className="p-3">
            <p className="font-mono text-[11px] uppercase text-muted">{host}</p>
            <p className="truncate font-display text-sm font-semibold text-ink">{title}</p>
            <p className="line-clamp-2 text-xs text-muted">{desc}</p>
          </div>
        </div>
      </div>

      <p className="font-mono text-[11px] text-muted">
        Canonical: <span className="text-ink">{canonical}</span>
      </p>
    </div>
  );
}
