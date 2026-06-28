// /unsubscribe?token=… — tokenized one-click unsubscribe. The token is unguessable, so the GET
// performs the unsubscribe directly (the standard email-link behavior) and is idempotent; a POST
// is also accepted for RFC 8058 List-Unsubscribe-Post one-click. No login, no PII beyond the email
// the token resolves to. noindex.
import { Link } from "react-router";
import { and, eq, isNull } from "drizzle-orm";
import type { Route } from "./+types/unsubscribe";
import { getEnv } from "~/lib/context.server";
import { getDb } from "~/db/index.server";
import { subscribers } from "~/db/schema";

type Result = { status: "done" | "already" | "invalid"; email?: string };

async function unsubscribe(env: Env, token: string | null): Promise<Result> {
  if (!token) return { status: "invalid" };
  const db = getDb(env);
  const rows = await db
    .select({ email: subscribers.email, unsubscribedAt: subscribers.unsubscribedAt })
    .from(subscribers)
    .where(eq(subscribers.unsubscribeToken, token))
    .limit(1);
  const row = rows[0];
  if (!row) return { status: "invalid" };
  if (row.unsubscribedAt) return { status: "already", email: row.email };
  await db
    .update(subscribers)
    .set({ unsubscribedAt: new Date().toISOString() })
    .where(and(eq(subscribers.unsubscribeToken, token), isNull(subscribers.unsubscribedAt)));
  return { status: "done", email: row.email };
}

export function meta() {
  return [{ title: "Unsubscribe · Germomics" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const token = new URL(request.url).searchParams.get("token");
  return unsubscribe(getEnv(context), token);
}

export async function action({ request, context }: Route.ActionArgs) {
  // RFC 8058 one-click: the token can arrive in the POST body or the query string.
  const url = new URL(request.url);
  let token = url.searchParams.get("token");
  if (!token) {
    const form = await request.formData().catch(() => null);
    token = form ? String(form.get("token") ?? "") || null : null;
  }
  return unsubscribe(getEnv(context), token);
}

export default function Unsubscribe({ loaderData }: Route.ComponentProps) {
  const { status, email } = loaderData;
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-display text-2xl font-semibold">
        {status === "invalid" ? "Link not recognized" : "Unsubscribed"}
      </h1>
      <p className="mt-3 text-muted">
        {status === "done" && (
          <>
            {email ? <strong className="text-ink">{email}</strong> : "You"} has been removed from the
            Germomics newsletter. Sorry to see you go.
          </>
        )}
        {status === "already" && "You’re already unsubscribed. No further emails will be sent."}
        {status === "invalid" &&
          "This unsubscribe link is missing or invalid. If you keep receiving emails, reply to one and we’ll remove you."}
      </p>
      <div className="mt-6 flex justify-center gap-4 font-mono text-sm">
        <Link to="/" className="text-accent hover:underline">
          Home
        </Link>
        <Link to="/subscribe" className="text-accent hover:underline">
          Re-subscribe
        </Link>
      </div>
    </div>
  );
}
