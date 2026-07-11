// One-off: generate 400w/795w WebP variants for the episode 1-9 inline figures (topic + pathogen
// photo per episode), sourced from the local desktop copy of the old WordPress media.
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import os from "node:os";

const SRC_DIR = join(os.homedir(), "Desktop", "germomics");
const OUT = join(os.tmpdir(), "germomics-ep1-9-variants");

// episodeSlug -> [ { src, subjectSlug, widths } ]. widths omits 400 where the manifest confirms no
// distinct thumb ever existed on the old site for that image.
const EPISODES = {
  "a-sky-full-of-sars": [
    { src: "germomics-coronavirus.jpg", slug: "coronavirus", widths: [795, 400] },
    { src: "germomics-civet.jpg", slug: "civet", widths: [795, 400] },
  ],
  "on-the-right-taq": [
    { src: "germomics-yellowstone-hot-springs.jpg", slug: "yellowstone-hot-springs", widths: [795] },
    { src: "germomics-thermus-aquaticus.jpg", slug: "thermus-aquaticus", widths: [795, 400] },
  ],
  "confessions-of-a-cholera-girl": [
    { src: "germomics-hurricane-matthew.png", slug: "hurricane-matthew", widths: [795, 400] },
    { src: "germomics-vibrio-cholerae.jpg", slug: "vibrio-cholerae", widths: [795, 400] },
  ],
  "one-flew-over-the-kuru-nest": [
    { src: "germomics-truckee-river.jpg", slug: "truckee-river", widths: [795] },
    { src: "germomics-kuru.jpg", slug: "kuru", widths: [795] },
  ],
  "its-on-the-syphilis": [
    { src: "germomics-dilophosaurus.jpg", slug: "dilophosaurus", widths: [795] },
    { src: "germomics-treponema-pallidum.jpg", slug: "treponema-pallidum", widths: [795] },
  ],
  "theres-something-about-typhoid-mary": [
    { src: "germomics-theodore-roosevelt.jpg", slug: "theodore-roosevelt", widths: [795, 400] },
    { src: "germomics-salmonella-enterica-typhi.jpg", slug: "salmonella-enterica-typhi", widths: [795, 400] },
  ],
  "a-boy-named-flu": [
    { src: "germomics-influenza.jpg", slug: "influenza", widths: [795, 400] },
    { src: "germomics-christopher-columbus.jpg", slug: "christopher-columbus", widths: [795, 400] },
  ],
  "rabies-day-out": [
    { src: "germomics-edgar-allen-poe.jpg", slug: "edgar-allen-poe", widths: [795] },
    { src: "germomics-rabies.jpg", slug: "rabies", widths: [795] },
  ],
  "hell-on-weils": [
    { src: "germomics-brazil-carnival.jpg", slug: "brazil-carnival", widths: [795, 400] },
    { src: "germomics-leptospira.jpg", slug: "leptospira", widths: [795, 400] },
  ],
};

const manifest = [];

for (const [epSlug, images] of Object.entries(EPISODES)) {
  for (const img of images) {
    const srcPath = join(SRC_DIR, img.src);
    for (const width of img.widths) {
      const key = `${epSlug}/${img.slug}-${width}.webp`;
      const outPath = join(OUT, key);
      await mkdir(join(OUT, epSlug), { recursive: true });
      const buf = await sharp(srcPath).resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
      await writeFile(outPath, buf);
      const meta = await sharp(buf).metadata();
      manifest.push({ key, outPath, width: meta.width, height: meta.height, bytes: buf.length });
    }
  }
}

await writeFile(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("OUT=" + OUT);
for (const m of manifest) console.log(`${m.key}\t${m.width}x${m.height}\t${m.bytes}B`);
console.log("TOTAL=" + manifest.length);
