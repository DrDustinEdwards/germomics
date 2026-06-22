// Client-safe access to snippets. The root loader exposes the snippet map; useSnippet() reads it
// with the same in-code fallback the server uses, so a missing row never breaks a component.
import { useRouteLoaderData } from "react-router";
import { SNIPPET_DEFAULTS } from "~/lib/content-defaults";

export function useSnippet(key: string, fallback = ""): string {
  const root = useRouteLoaderData("root") as { snippets?: Record<string, string> } | undefined;
  return root?.snippets?.[key] ?? SNIPPET_DEFAULTS[key] ?? fallback;
}
