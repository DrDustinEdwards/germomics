// One-time backfill: populate posts.audio_peaks for the existing episodes so the episode-page
// waveform draws the real loudness envelope instead of the synth fallback. Runs locally under
// Node (Claude has no audio access and media.germomics.com is not reachable from its sandbox).
//
// Pipeline per episode: fetch(audio_url) -> arrayBuffer -> audio-decode (pure-JS WASM mp3 decoder,
// no native installs) -> Float32 channels -> computePeaks(channels, 400) -> UPDATE posts via
// wrangler. Idempotent: only fills rows where audio_peaks IS NULL, unless --force is passed.
//
// Usage:
//   node scripts/backfill-peaks.mjs           # fill only episodes with null audio_peaks
//   node scripts/backfill-peaks.mjs --force    # recompute every episode
import { execSync } from "node:child_process";
import { computePeaks } from "../app/lib/peaks.ts";
import decodeAudio from "audio-decode";

const N = 400;
const DB = "germomics";
const FORCE = process.argv.includes("--force");

// Run wrangler via a single shell string so quoting is deterministic on Windows (cmd) and POSIX.
// SQL is wrapped in double quotes; the JSON we write uses single quotes, which stay literal inside
// double quotes on both shells. The JSON is ints only, so there is nothing to escape.
function wrangler(extra, sql) {
  const cmd = `npx wrangler d1 execute ${DB} --remote ${extra} --command "${sql}"`;
  return execSync(cmd, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

// `wrangler d1 execute --json` prints an array of { results, success, meta }.
function query(sql) {
  const out = wrangler("--json", sql);
  // The JSON may be preceded by wrangler banner lines; slice from the first bracket.
  const start = out.indexOf("[");
  const parsed = JSON.parse(out.slice(start));
  return parsed[0]?.results ?? [];
}

function exec(sql) {
  wrangler("", sql);
}

async function main() {
  const rows = query(
    "SELECT id, slug, audio_url, audio_peaks FROM posts WHERE kind='episode' ORDER BY id",
  );
  console.log(`Found ${rows.length} episodes (force=${FORCE}).`);

  let filled = 0;
  let skipped = 0;
  for (const row of rows) {
    const { id, slug, audio_url, audio_peaks } = row;
    if (!FORCE && audio_peaks != null) {
      console.log(`  skip  ${slug} (already has peaks)`);
      skipped++;
      continue;
    }
    if (!audio_url) {
      console.log(`  skip  ${slug} (no audio_url)`);
      skipped++;
      continue;
    }
    try {
      const res = await fetch(audio_url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ab = await res.arrayBuffer();
      const audio = await decodeAudio(ab);
      // audio-decode v3 returns { channelData: Float32Array[], sampleRate }. Older AudioBuffer-style
      // results expose getChannelData/numberOfChannels; support both.
      const channels = Array.isArray(audio.channelData)
        ? audio.channelData
        : Array.from({ length: audio.numberOfChannels }, (_, c) => audio.getChannelData(c));
      const peaks = computePeaks(channels, N);
      const json = JSON.stringify(peaks); // ints only, no quotes to escape
      exec(`UPDATE posts SET audio_peaks='${json}' WHERE id=${id}`);
      const max = Math.max(...peaks);
      console.log(
        `  ok    ${slug}  peaks=${peaks.length}  max=${max}  bytes=${(ab.byteLength / 1e6).toFixed(1)}MB`,
      );
      filled++;
    } catch (err) {
      console.error(`  FAIL  ${slug}: ${err.message}`);
    }
  }
  console.log(`Done. filled=${filled} skipped=${skipped} total=${rows.length}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
