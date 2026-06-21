// Heavy + DOM-only: imported ONLY via lazy() from data.$slug, so Recharts is code-split and
// stays out of the server/content bundles. Decorative (the data table is the text equivalent).
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Series } from "~/lib/datasets.server";

export default function DataChart({ data, unit }: { data: Series[]; unit: string }) {
  return (
    <div aria-hidden className="h-72 w-full rounded-xl border border-border bg-card p-3">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke="var(--color-muted)" fontSize={12} />
          <YAxis stroke="var(--color-muted)" fontSize={12} />
          <Tooltip
            formatter={(value) => [`${value}`, unit]}
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 8,
              color: "var(--color-ink)",
            }}
          />
          <Line type="monotone" dataKey="value" stroke="var(--color-brand)" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
