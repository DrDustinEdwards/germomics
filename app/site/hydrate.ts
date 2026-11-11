// The play buttons' part of hydrate on intent. A public page sends no React (root.tsx), but its play buttons need the
// player, whose one <audio> element keeps playing while client-side navigation changes the page around it. The network's
// hydrate on intent (@dustinedwards/site-runtime/hydrate-on-intent) runs React Router's boot on the first press, hover
// or focus of a play button (data-play-intent, components/content/PlayButton.tsx) and hands the press to the button once
// the app is live; this file is only what germomics' player does before then: the press starts the audio at once,
// inside the press, and the player adopts the playing element (components/player/player-context.tsx).
import { hydrateOnIntent } from "@dustinedwards/site-runtime/hydrate-on-intent";
import { AUDIO_STARTED_ATTRIBUTE } from "../lib/hydration";
import { resumeAt, storedRate, storedVolume } from "../lib/player-storage";

/**
 * Points the page's <audio> element (the one the player renders, which hydration adopts) at the button's episode,
 * resuming where the reader left off once its metadata is in, as the player would.
 */
function load(audio: HTMLAudioElement, button: HTMLElement) {
  const src = button.dataset.audioSrc;
  if (!src) return;
  const url = new URL(src, location.href).href;
  if (audio.src === url) return;
  // The element is preload="none" until a reader reaches for an episode; this is that moment.
  audio.preload = "metadata";
  audio.src = url;
  const id = button.dataset.trackId;
  audio.addEventListener(
    "loadedmetadata",
    () => {
      const at = id ? resumeAt(id, audio.duration) : null;
      if (at !== null) audio.currentTime = at;
    },
    { once: true },
  );
}

/**
 * Plays the pressed episode inside the press itself, since Safari and iOS refuse a play() that comes later, after React
 * has loaded, with the remembered rate and volume. Pressing the same button again before React is live pauses it.
 * Returns whether the press still needs the app (false once it paused).
 */
function playNow(button: HTMLElement): boolean {
  const audio = document.querySelector("audio");
  if (!audio || !button.dataset.audioSrc) return true;
  if (audio.src === new URL(button.dataset.audioSrc, location.href).href && !audio.paused) {
    audio.pause();
    audio.removeAttribute(AUDIO_STARTED_ATTRIBUTE);
    return false;
  }
  load(audio, button);
  audio.playbackRate = storedRate() ?? 1;
  audio.volume = storedVolume() ?? 1;
  audio.setAttribute(AUDIO_STARTED_ATTRIBUTE, "");
  audio.play().catch(() => audio.removeAttribute(AUDIO_STARTED_ATTRIBUTE));
  return true;
}

/** A pointer resting on a play button, or the focus reaching one, loads the episode's metadata on the idle element. */
function warm(button: HTMLElement) {
  const audio = document.querySelector("audio");
  if (audio && audio.paused) load(audio, button);
}

export function enhancePlayIntent() {
  hydrateOnIntent({ selector: "[data-play-intent]", press: playNow, warm });
}
