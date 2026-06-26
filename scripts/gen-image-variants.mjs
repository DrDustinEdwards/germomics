import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import os from "node:os";

const DOWNLOADS = join(os.homedir(), "Downloads");
const OUT = join(os.tmpdir(), "germomics-variants");

const FORMATS = [
  { ext: "jpg", type: "image/jpeg" },
  { ext: "webp", type: "image/webp" },
  { ext: "avif", type: "image/avif" },
];

// source file -> { keyBase, widths }
const JOBS = [
  { src: "germomics-logo-square-artwork.jpg", keyBase: "brand/germomics-artwork", widths: [1400, 600, 300] },
  { src: "germomics-corynebacterium-diphtheriae.jpg", keyBase: "antitoxin-togo-please/corynebacterium-diphtheriae", widths: [795, 400] },
  { src: "germomics-seppala-togo.jpg", keyBase: "antitoxin-togo-please/seppala-togo", widths: [795, 400] },
  { src: "germomics-antitoxin-togo-pls.jpg", keyBase: "antitoxin-togo-please/antitoxin-togo-pls", widths: [795, 400] },
];

const manifest = [];

for (const job of JOBS) {
  const srcPath = join(DOWNLOADS, job.src);
  for (const width of job.widths) {
    for (const fmt of FORMATS) {
      const key = `${job.keyBase}-${width}.${fmt.ext}`;
      const outPath = join(OUT, key);
      await mkdir(dirname(outPath), { recursive: true });

      let pipe = sharp(srcPath).resize({ width, withoutEnlargement: true });
      if (fmt.ext === "jpg") pipe = pipe.jpeg({ quality: 82, mozjpeg: true });
      else if (fmt.ext === "webp") pipe = pipe.webp({ quality: 80 });
      else if (fmt.ext === "avif") pipe = pipe.avif({ quality: 55 });

      const buf = await pipe.toBuffer();
      await writeFile(outPath, buf);
      const meta = await sharp(buf).metadata();
      manifest.push({ key, path: outPath, type: fmt.type, width: meta.width, height: meta.height, bytes: buf.length });
    }
  }
}

await writeFile(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("OUT=" + OUT);
for (const m of manifest) console.log(`${m.key}\t${m.width}x${m.height}\t${m.bytes}B\t${m.type}`);
console.log("TOTAL=" + manifest.length);
