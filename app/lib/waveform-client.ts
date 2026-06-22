// Client-only audio analysis. Decodes an audio file/URL in the browser to extract a compact
// waveform (peaks 0..1) for preview + chapter scrubbing, plus the precise duration. Heavy work
// but admin-only and one-shot per upload.
const BUCKETS = 240;

type AudioCtor = typeof AudioContext;
function getAudioContext(): AudioContext | null {
  const Ctor: AudioCtor | undefined =
    typeof AudioContext !== "undefined"
      ? AudioContext
      : (globalThis as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

export async function computePeaks(
  source: ArrayBuffer,
): Promise<{ peaks: number[]; duration: number } | null> {
  const ctx = getAudioContext();
  if (!ctx) return null;
  try {
    const buffer = await ctx.decodeAudioData(source.slice(0));
    const channel = buffer.getChannelData(0);
    const block = Math.floor(channel.length / BUCKETS) || 1;
    const peaks: number[] = [];
    let max = 0;
    for (let i = 0; i < BUCKETS; i++) {
      let peak = 0;
      const start = i * block;
      for (let j = 0; j < block && start + j < channel.length; j++) {
        const v = Math.abs(channel[start + j]);
        if (v > peak) peak = v;
      }
      peaks.push(peak);
      if (peak > max) max = peak;
    }
    // Normalize 0..1.
    const norm = max > 0 ? peaks.map((p) => Math.round((p / max) * 100) / 100) : peaks;
    return { peaks: norm, duration: buffer.duration };
  } catch {
    return null;
  } finally {
    void ctx.close();
  }
}

/** Quick duration probe without full decode (used as a fallback). */
export function probeDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      resolve(Number.isFinite(audio.duration) ? Math.floor(audio.duration) : null);
      URL.revokeObjectURL(audio.src);
    };
    audio.onerror = () => resolve(null);
    audio.src = URL.createObjectURL(file);
  });
}
