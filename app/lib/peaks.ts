// Shared, env-agnostic waveform bucketing. No audio decoding lives here, so the Node backfill
// script and the admin browser path can both import this one function. Input is already-decoded
// PCM (one Float32Array per channel); output is the stored contract: a fixed-length array of
// integers 0..100, normalized so the loudest slice in the episode is 100. See waveform-peaks-spec.
//
// Format contract: audio_peaks = number[] of length N (400), each int 0..100. The renderer divides
// by 100 for bar height and downsamples to its display bar count (it never upsamples).
export function computePeaks(channels: Float32Array[], N = 400): number[] {
  const len = channels[0].length;
  const bucket = Math.max(1, Math.floor(len / N));
  const peaks = new Array(N).fill(0);
  for (let b = 0; b < N; b++) {
    const start = b * bucket;
    const end = b === N - 1 ? len : start + bucket;
    let max = 0;
    for (let i = start; i < end; i++) {
      let s = 0;
      for (let c = 0; c < channels.length; c++) s += Math.abs(channels[c][i]);
      s /= channels.length; // mono mixdown
      if (s > max) max = s; // peak in slice
    }
    peaks[b] = max;
  }
  const gmax = Math.max(...peaks) || 1;
  // Linear normalize so the loudest slice is 100.
  return peaks.map((p) => Math.round((p / gmax) * 100));
}
