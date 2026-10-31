// One-off: rasterize the Germomics G hexagon mark into favicon/app-icon assets, and the wordmark into
// the share card. Source of truth is public/brand/germomics-g.svg (transparent bg) and
// germomics-wordmark-white.svg. Run with `node scripts/gen-icons.mjs`.
//
// Two transparency policies on purpose:
//  - Browser-tab favicons (favicon.ico) stay TRANSPARENT — they sit on the tab chrome.
//  - Home-screen / install icons (apple-touch, 192, 512, maskable) are OPAQUE — iOS/Android
//    render transparent areas as black, which breaks the hexagon's corner gaps.
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const srcPath = resolve(root, "public/brand/germomics-g.svg");
const srcText = readFileSync(srcPath, "utf8");
const src = readFileSync(srcPath);
const out = (p) => resolve(root, "public", p);

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const TILE = "#FBFAFD"; // light page bg — flatten install icons onto this (NOT the brand violet, which would hide the purple hexagon)
const VIOLET = "#4F2D7F"; // brand / crystal violet — maskable tile background

// Transparent-background PNG at a given square size (favicons).
const png = (size) =>
  sharp(src, { density: 384 })
    .resize(size, size, { fit: "contain", background: TRANSPARENT })
    .png()
    .toBuffer();

// Opaque PNG: the full mark flattened onto a solid white tile.
const opaquePng = (size) =>
  sharp(src, { density: 384 })
    .resize(size, size, { fit: "contain", background: TRANSPARENT })
    .flatten({ background: TILE })
    .png()
    .toBuffer();

// Opaque install icons (home screen + PWA "any" purpose).
for (const [name, size] of [
  ["apple-touch-icon.png", 180],
  ["icon-192.png", 192],
  ["icon-512.png", 512],
]) {
  const buf = await opaquePng(size);
  writeFileSync(out(name), buf);
  console.log(`wrote public/${name} (${size}x${size} opaque ${TILE}, ${buf.length} bytes)`);
}

// Maskable Android adaptive tile: solid violet square + white "G" (the letter only, not the
// hexagon — the square tile is the container). The G is scaled to ~60% of the canvas and
// centered so it survives Android's circular safe-zone crop (central 80%).
{
  const MASK = 512;
  const G_WIDTH = Math.round(MASK * 0.6); // ~307px — well inside the 80% safe circle

  // Pull the white G path out of the source SVG (the fill="#FFFFFF" path), keep its viewBox.
  const viewBox = srcText.match(/viewBox="([^"]+)"/)[1];
  const gPath = srcText.match(/<path[^>]*fill="#FFFFFF"[^>]*d="([^"]+)"/)[1];
  const gSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path fill="#FFFFFF" d="${gPath}"/></svg>`;

  // Render the G, trim transparent margins to its true bounds, then scale to target width.
  const g = await sharp(Buffer.from(gSvg), { density: 512 })
    .png()
    .trim()
    .resize({ width: G_WIDTH })
    .toBuffer();

  const buf = await sharp({
    create: { width: MASK, height: MASK, channels: 4, background: VIOLET },
  })
    .composite([{ input: g, gravity: "center" }])
    .png()
    .toBuffer();
  writeFileSync(out("icon-maskable-512.png"), buf);
  console.log(`wrote public/icon-maskable-512.png (${MASK}x${MASK} maskable ${VIOLET}, ${buf.length} bytes)`);
}

// The share card of every page without its own image (DEFAULT_CARD, app/lib/site.ts): 1200x630, the
// white wordmark on violet at the cover art's proportions, as JPEG, which every link preview reads.
{
  const [W, H, LOGO_H] = [1200, 630, 470];
  const logo = await sharp(resolve(root, "public/brand/germomics-wordmark-white.svg"), { density: 300 })
    .resize({ height: LOGO_H })
    .toBuffer();
  const buf = await sharp({ create: { width: W, height: H, channels: 3, background: VIOLET } })
    .composite([{ input: logo, gravity: "center" }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
  writeFileSync(out("brand/germomics-card.jpg"), buf);
  console.log(`wrote public/brand/germomics-card.jpg (${W}x${H} ${VIOLET}, ${buf.length} bytes)`);
}

// Multi-size .ico (16/32/48), TRANSPARENT, PNG-compressed entries (modern browsers + Windows).
const icoSizes = [16, 32, 48];
const images = await Promise.all(icoSizes.map(png));
const HEADER = 6;
const ENTRY = 16;
let offset = HEADER + ENTRY * images.length;
const dir = Buffer.alloc(HEADER + ENTRY * images.length);
dir.writeUInt16LE(0, 0); // reserved
dir.writeUInt16LE(1, 2); // type 1 = icon
dir.writeUInt16LE(images.length, 4); // image count
images.forEach((buf, i) => {
  const size = icoSizes[i];
  const e = HEADER + ENTRY * i;
  dir.writeUInt8(size >= 256 ? 0 : size, e + 0); // width
  dir.writeUInt8(size >= 256 ? 0 : size, e + 1); // height
  dir.writeUInt8(0, e + 2); // palette count
  dir.writeUInt8(0, e + 3); // reserved
  dir.writeUInt16LE(1, e + 4); // color planes
  dir.writeUInt16LE(32, e + 6); // bits per pixel
  dir.writeUInt32LE(buf.length, e + 8); // bytes in image data
  dir.writeUInt32LE(offset, e + 12); // offset of image data
  offset += buf.length;
});
const ico = Buffer.concat([dir, ...images]);
writeFileSync(out("favicon.ico"), ico);
console.log(`wrote public/favicon.ico (${icoSizes.join("/")} transparent, ${ico.length} bytes)`);
