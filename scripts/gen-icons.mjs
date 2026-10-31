// One-off: rasterize the white wordmark into the share card. The favicon and app icons are Prelum's
// shared icon set (iconLinks, app/root.tsx); this script makes only the card. Source of truth is
// public/brand/germomics-wordmark-white.svg. Run with `node scripts/gen-icons.mjs`.
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const VIOLET = "#4F2D7F"; // brand / crystal violet

// The share card of every page without its own image (DEFAULT_CARD, app/lib/site.ts): 1200x630, the
// white wordmark on violet at the cover art's proportions, as JPEG, which every link preview reads.
const [W, H, LOGO_H] = [1200, 630, 470];
const logo = await sharp(resolve(root, "public/brand/germomics-wordmark-white.svg"), { density: 300 })
  .resize({ height: LOGO_H })
  .toBuffer();
const buf = await sharp({ create: { width: W, height: H, channels: 3, background: VIOLET } })
  .composite([{ input: logo, gravity: "center" }])
  .jpeg({ quality: 88, mozjpeg: true })
  .toBuffer();
writeFileSync(resolve(root, "public/brand/germomics-card.jpg"), buf);
console.log(`wrote public/brand/germomics-card.jpg (${W}x${H} ${VIOLET}, ${buf.length} bytes)`);
