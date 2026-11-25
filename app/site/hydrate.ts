// Hydrate on intent: a public page sends no React (lib/hydration.ts), but its play buttons need the player, whose one
// <audio> element must keep playing across client-side navigation. The first press of a play button (data-play-intent)
// starts the audio inside the press, then boots React Router; the player adopts the playing element and the queue is
// set as it would have been. A pointer resting on a button, or focus reaching one, starts the work early. A page that
// hydrates on load has no <noscript>, and this stays out of its way.
import { hydrateOnIntent } from "@dustinedwards/site-runtime/hydrate-on-intent";
import { AUDIO_SELECTOR, loadTrack, playerStorage, startTrack } from "capsomer/behavior/player";

// The player's remembered state, read as the player reads it, so a press before React sounds and resumes the same.
const storage = playerStorage("germomics-");

function trackOf(button: HTMLElement): { id: string; src: string } | null {
  const src = button.dataset.audioSrc;
  return src ? { id: button.dataset.trackId ?? src, src } : null;
}

export function enhanceHydrateOnIntent() {
  hydrateOnIntent({
    selector: "[data-play-intent]",
    // Played inside the press: Safari and iOS refuse a later play(). Pressing the playing episode again pauses it with no app.
    press(button) {
      const audio = document.querySelector<HTMLAudioElement>(AUDIO_SELECTOR);
      const track = trackOf(button);
      return !audio || !track || startTrack(audio, track, storage);
    },
    warm(button) {
      const audio = document.querySelector<HTMLAudioElement>(AUDIO_SELECTOR);
      const track = trackOf(button);
      if (audio && track && audio.paused) loadTrack(audio, track, storage);
    },
  });
}
