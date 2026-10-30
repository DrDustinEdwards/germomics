// /unsubscribe?token=...: tokenized unsubscribe. Opening the link only looks the token up and shows
// a confirm button: mail scanners and link previews open every link in a message, so a GET that
// changed data would unsubscribe people who never asked. The change happens on POST, from that
// button or from an RFC 8058 List-Unsubscribe-Post one-click request, and is idempotent. No login,
// no PII beyond the email the token resolves to. noindex.
import { Form } from "react-router";
import { Link } from "capsomer/react/link";
import { and, eq, isNull } from "drizzle-orm";
import type { Route } from "./+types/unsubscribe";
import { getEnv } from "~/lib/context.server";
import { getDb } from "~/db/index.server";
import { subscribers } from "~/db/schema";

type Result = { status: "confirm" | "done" | "already" | "invalid"; email?: string; token?: string };

async function lookup(env: Env, token: string | null) {
  if (!token) return null;
  const rows = await getDb(env)
    .select({ email: subscribers.email, unsubscribedAt: subscribers.unsubscribedAt })
    .from(subscribers)
    .where(eq(subscribers.unsubscribeToken, token))
    .limit(1);
  return rows[0] ?? null;
}

async function unsubscribe(env: Env, token: string | null): Promise<Result> {
  const row = await lookup(env, token);
  if (!row || !token) return { status: "invalid" };
  if (row.unsubscribedAt) return { status: "already", email: row.email };
  await getDb(env)
    .update(subscribers)
    .set({ unsubscribedAt: new Date().toISOString() })
    .where(and(eq(subscribers.unsubscribeToken, token), isNull(subscribers.unsubscribedAt)));
  return { status: "done", email: row.email };
}

export function meta() {
  return [{ title: "Unsubscribe · Germomics" }, { name: "robots", content: "noindex" }];
}

// Read only: never changes the row (see the header).
export async function loader({ request, context }: Route.LoaderArgs): Promise<Result> {
  const token = new URL(request.url).searchParams.get("token");
  const row = await lookup(getEnv(context), token);
  if (!row || !token) return { status: "invalid" };
  if (row.unsubscribedAt) return { status: "already", email: row.email };
  return { status: "confirm", email: row.email, token };
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

export default function Unsubscribe({ loaderData, actionData }: Route.ComponentProps) {
  const { status, email, token } = actionData ?? loaderData;
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-display text-2xl font-semibold">
        {status === "invalid" ? "Link not recognized" : status === "confirm" ? "Unsubscribe?" : "Unsubscribed"}
      </h1>
      <p className="mt-3 text-muted">
        {status === "confirm" && (
          <>
            Stop sending the Germomics newsletter to{" "}
            {email ? <strong className="text-ink">{email}</strong> : "this address"}?
          </>
        )}
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
      {status === "confirm" && (
        <Form method="post" className="mt-6">
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2 font-display text-sm font-medium text-bg hover:bg-brand-strong"
          >
            Unsubscribe
          </button>
        </Form>
      )}
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
