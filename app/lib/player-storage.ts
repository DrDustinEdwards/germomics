// What the player remembers in localStorage: each episode's resume position, the playback rate and the volume. Read
// by the player (components/player/player-context.tsx) and by /site.js, which starts a press's audio before React
// loads (app/site/hydrate.ts), so both resume and sound the same. Client-safe, no React.
export const RESUME_PREFIX = "germomics-resume-";
export const RATE_KEY = "germomics-rate";
export const VOL_KEY = "germomics-volume";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** The remembered rate, 0.5 to 3, or null. */
export function storedRate(): number | null {
  const r = Number(read(RATE_KEY));
  return r >= 0.5 && r <= 3 ? r : null;
}

/** The remembered volume, 0 to 1, or null. */
export function storedVolume(): number | null {
  const v = read(VOL_KEY);
  return v !== null && Number(v) >= 0 && Number(v) <= 1 ? Number(v) : null;
}

/** Where to resume an episode of `duration` seconds, or null: never within its last five seconds. */
export function resumeAt(id: number | string, duration: number): number | null {
  const saved = Number(read(RESUME_PREFIX + id));
  return saved > 0 && saved < duration - 5 ? saved : null;
}
