// Shared admin UI primitives — consistent inputs, cards, buttons, tabs, badges and char
// counters on the germomics design tokens. Accessible by construction: labels tied to inputs,
// visible focus (global :focus-visible), 24px+ targets, errors wired via aria-describedby.
import { useId } from "react";

export const inputCx =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-ink outline-none " +
  "placeholder:text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30";

export function Card({
  title,
  icon,
  children,
  actions,
  className = "",
}: {
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-border bg-card ${className}`}>
      {title ? (
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
            {icon}
            {title}
          </h2>
          {actions}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  error,
  required,
  children,
  count,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  count?: { value: number; max?: number };
  children: (ids: { id: string; describedBy?: string }) => React.ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="font-display text-sm font-medium text-ink">
          {label}
          {required ? <span className="ml-0.5 text-brand" aria-hidden> *</span> : null}
        </label>
        {count ? (
          <span
            className={`font-mono text-[11px] tabular-nums ${
              count.max && count.value > count.max ? "text-brand" : "text-muted"
            }`}
          >
            {count.value}
            {count.max ? `/${count.max}` : ""}
          </span>
        ) : null}
      </div>
      {children({ id, describedBy })}
      {hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errId} role="alert" className="text-xs font-medium text-brand">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type BtnVariant = "primary" | "accent" | "ghost" | "danger";
const BTN: Record<BtnVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong",
  accent: "bg-accent text-bg hover:brightness-110",
  ghost: "border border-border bg-card text-ink hover:border-brand",
  danger: "border border-border bg-card text-brand hover:border-brand",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-[2.25rem] items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 font-display text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${BTN[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-lg border border-border bg-surface p-0.5">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-display text-xs font-medium transition ${
              active ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "brand" | "accent" | "amber";
}) {
  const cx = {
    muted: "border-border text-muted",
    brand: "border-brand/40 text-brand",
    accent: "border-accent/40 text-accent",
    amber: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${cx}`}>
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
      {children}
    </div>
  );
}
