// /subscribe/confirm?token=...: the double opt-in link mailed by /subscribe (app/lib/newsletter.server.ts). Opening the
// link only checks it and shows a confirm button, because mail scanners and link previews open every link in a message;
// the subscription starts on POST, from that button. noindex, rendered live (workers/app.ts) and never prefetched.
import { Form } from "react-router";
import { Link } from "capsomer/react/link";
import type { Route } from "./+types/subscribe.confirm";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { checkConfirmation, confirmSubscription, type Confirmation } from "~/lib/newsletter.server";
import { readForm } from "@dustinedwards/site-runtime/body";
import { PUBLIC_FORM } from "~/lib/body.server";

type Result = Confirmation & { token?: string };

export function meta() {
  return [{ title: "Confirm subscription · Germomics" }, { name: "robots", content: "noindex" }];
}

// Read only: never changes the row (see the header).
export async function loader({ request, context }: Route.LoaderArgs): Promise<Result> {
  const token = new URL(request.url).searchParams.get("token");
  const result = await checkConfirmation(getEnv(context), token);
  return result.status === "confirm" && token ? { ...result, token } : result;
}

export async function action({ request, context }: Route.ActionArgs): Promise<Result> {
  const form = await readForm(request, PUBLIC_FORM).catch(() => null);
  const token = form ? String(form.get("token") ?? "") || null : null;
  return confirmSubscription(getEnv(context), token);
}

const TITLES: Record<Result["status"], string> = {
  confirm: "Confirm your subscription",
  done: "You’re subscribed",
  expired: "This link has expired",
  invalid: "Link not recognized",
};

export default function ConfirmSubscription({ loaderData, actionData }: Route.ComponentProps) {
  const { status, email, token } = actionData ?? loaderData;
  const who = email ? <strong className="gm-ink">{email}</strong> : "this address";
  return (
    <div className="gm-notice">
      <h1 className="gm-notice-title">{TITLES[status]}</h1>
      <p className="gm-notice-text">
        {status === "confirm" && <>Send the Germomics newsletter to {who}?</>}
        {status === "done" && (
          <>
            The Germomics newsletter will be sent to {who}. Every email has a link to unsubscribe.
          </>
        )}
        {status === "expired" &&
          "Confirmation links work for 7 days. Sign up again and we’ll send a new one."}
        {status === "invalid" &&
          "This confirmation link is missing, already used or replaced by a newer one. Sign up again for a new link."}
      </p>
      {status === "confirm" && (
        <Form method="post" className="gm-notice-form">
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="gm-notice-button">
            Confirm subscription
          </button>
        </Form>
      )}
      <div className="gm-notice-links">
        <Link to="/" className="gm-link">
          Home
        </Link>
        {status === "expired" || status === "invalid" ? (
          <Link to="/subscribe" className="gm-link">
            Sign up again
          </Link>
        ) : null}
      </div>
    </div>
  );
}
