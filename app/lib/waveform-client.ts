// Client-only audio analysis. Decodes an audio file/URL in the browser, then hands the raw PCM
// channels to the shared bucketing util (peaks.ts) to produce the stored waveform contract: an
// array of integers 0..100, length 400, normalized so the loudest slice is 100. Also returns the
// precise duration. Heavy work, but admin-only and one-shot per upload. The Worker never decodes
// audio; this runs in the admin browser where the file already exists.
import { computePeaks as bucketPeaks } from "./peaks";

const N = 400;

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
    const channels: Float32Array[] = [buffer.getChannelData(0)];
    if (buffer.numberOfChannels > 1) channels.push(buffer.getChannelData(1));
    const peaks = bucketPeaks(channels, N);
    return { peaks, duration: buffer.duration };
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
