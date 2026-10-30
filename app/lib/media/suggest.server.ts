// Tags and alt text a model suggests for one image: site-api's mediaSuggester (Workers AI, through Cloudflare AI
// Gateway when AI_GATEWAY_BASE_URL names one). Nothing here writes: a suggestion reaches the file only when a person
// accepts it as an alt or a tags write (CLAUDE.md rule 6, AI output is drafts only). Each call counts against the
// site's AI daily cap (security.server.ts). Only Dustin's own uploads are sent, never a visitor's data.
import { mediaSuggester } from "@dustinedwards/site-api";
import { aiCostCapExceeded, recordAiUse } from "~/lib/security.server";

/** What the model suggests for one stored picture. Throws when the site has no AI binding or the day's cap is reached. */
export const suggestFor = mediaSuggester<Env>({
  app: "germomics",
  describe: "on a microbiology and history podcast's website",
  rules: ["Do not guess at species that are not written in the picture."],
  beforeCall: async (env) => {
    if (await aiCostCapExceeded(env)) throw new Error("today's AI cap (the ai.daily_cap setting) is reached");
  },
  afterCall: (env) => recordAiUse(env),
});
