// The click-to-play embeds' island: Prelum's enhanceEmbeds swaps a lite embed link for its player when the reader asks, so a
// post loads no third party until then. Only a body that holds an embed loads it (BodyRenderer's data-island), so it never
// reaches /site.js or the shared chunk. germomics has its own lightbox, so it takes the embeds alone, not Prelum's whole enhance().
import { enhanceEmbeds } from "@drdustinedwards/site-helpers/render/enhance";

export default function embeds(): void {
  enhanceEmbeds({ root: '[data-island="embeds"]' });
}
