// Client-safe access to snippets. The root loader exposes the snippet map; useSnippet() reads it
// with the same in-code fallback the server uses, so a missing row never breaks a component.
import { createSnippetHook } from "capsomer/react/route-hooks";
import { SNIPPET_DEFAULTS } from "~/lib/content-defaults";

export const useSnippet = createSnippetHook(SNIPPET_DEFAULTS);
