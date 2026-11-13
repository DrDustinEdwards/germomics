// Hydrate on intent: a public page sends no React (lib/hydration.ts), but its play buttons need the player, whose one
// <audio> element keeps playing while client-side navigation changes the page around it. So the first press of a play
// button (data-play-intent, Capsomer's PlayTrackButton) starts the audio at once, inside the press, then runs
// React Router's boot, which the page holds as JSON, and is handed to the button once the
// app is live: the player adopts the playing element and the queue is set exactly as it would have been, with the
// focus where it was. A pointer resting on a play button, or the focus reaching one, starts the work early. From then
// on the page is the app, as every page was before. A page that hydrates on load has no <noscript>, and this stays
// out of its way.
import { hydrateOnIntent } from "@dustinedwards/site-runtime/hydrate-on-intent";
import { AUDIO_SELECTOR, loadTrack, playerStorage, startTrack } from "capsomer/behavior/player";

// What the player remembers (rate, volume, mute, each episode's position), read the same way the player reads it, so a
// press before React sounds and resumes as one after it.
const storage = playerStorage("germomics-");

/** The pressed button's episode (PlayTrackButton's data-audio-src and data-track-id), as the <audio> element needs it. */
function trackOf(button: HTMLElement): { id: string; src: string } | null {
  const src = button.dataset.audioSrc;
  return src ? { id: button.dataset.trackId ?? src, src } : null;
}

export function enhanceHydrateOnIntent() {
  hydrateOnIntent({
    selector: "[data-play-intent]",
    // Played inside the press itself, since Safari and iOS refuse a play() that comes later, after React has loaded.
    // Pressing the same playing episode again before React is live pauses it, and then the press needs no app.
    press(button) {
      const audio = document.querySelector<HTMLAudioElement>(AUDIO_SELECTOR);
      const track = trackOf(button);
      return !audio || !track || startTrack(audio, track, storage);
    },
    // The episode's metadata (and resume position) loads on the idle element, so a press plays at once.
    warm(button) {
      const audio = document.querySelector<HTMLAudioElement>(AUDIO_SELECTOR);
      const track = trackOf(button);
      if (audio && track && audio.paused) loadTrack(audio, track, storage);
    },
  });
}
