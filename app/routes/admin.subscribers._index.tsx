// Admin -> Subscribers: list (email, consent, status) + CSV export. Behind the admin gate
// (admin.tsx middleware). The newsletter stores email + consent timestamp + unsubscribe token only.
import { Mail, Download } from "lucide-react";
import { desc } from "drizzle-orm";
import type { Route } from "./+types/admin.subscribers._index";
import { getEnv } from "~/lib/context.server";
import { getDb } from "~/db/index.server";
import { subscribers } from "~/db/schema";
import { formatDate } from "~/lib/format";
import { EmptyState } from "~/components/admin/ui";

function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const rows = await getDb(env).select().from(subscribers).orderBy(desc(subscribers.createdAt));

  if (new URL(request.url).searchParams.get("export") === "csv") {
    const header = "email,consented_at,status,created_at";
    const body = rows
      .map((r) =>
        [r.email, r.consentedAt ?? "", r.unsubscribedAt ? "unsubscribed" : "active", r.createdAt]
          .map(csvCell)
          .join(","),
      )
      .join("\n");
    return new Response(`${header}\n${body}\n`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="subscribers.csv"',
      },
    });
  }

  return {
    rows: rows.map((r) => ({
      email: r.email,
      consentedAt: r.consentedAt,
      unsubscribedAt: r.unsubscribedAt,
      createdAt: r.createdAt,
    })),
  };
}

export default function SubscribersAdmin({ loaderData }: Route.ComponentProps) {
  const { rows } = loaderData;
  const active = rows.filter((r) => !r.unsubscribedAt).length;
  return (
    <div>
      <h1 className="flex items-center gap-2 font-display text-2xl font-semibold">
        <Mail size={22} aria-hidden /> Subscribers
      </h1>
      <p className="mt-1 flex items-center gap-3 text-sm text-muted">
        <span>
          {active} active of {rows.length}.
        </span>
        <a
          href="/admin/subscribers?export=csv"
          className="inline-flex items-center gap-1 font-mono text-xs text-accent hover:underline"
        >
          <Download size={13} aria-hidden /> Export CSV
        </a>
      </p>

      {rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState>No subscribers yet.</EmptyState>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <caption className="sr-only">Newsletter subscribers</caption>
            <thead>
              <tr className="border-b border-border text-left font-display text-muted">
                <th scope="col" className="px-4 py-2">Email</th>
                <th scope="col" className="px-4 py-2">Consented</th>
                <th scope="col" className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.email} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 font-mono text-xs">{r.email}</td>
                  <td className="px-4 py-2 text-muted">{formatDate(r.consentedAt) || "(none)"}</td>
                  <td className="px-4 py-2">
                    {r.unsubscribedAt ? (
                      <span className="text-muted">unsubscribed</span>
                    ) : (
                      <span className="text-accent">active</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
