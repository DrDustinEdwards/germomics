// Hydrate on intent: a public page sends no React (lib/hydration.ts), but its play buttons need the player, whose one
// <audio> element keeps playing while client-side navigation changes the page around it. So the first press of a play
// button (data-play-intent, components/content/PlayButton.tsx) starts the audio at once, inside the press, then runs
// React Router's hydration scripts, which the page holds as text in a <noscript>, and is handed to the button once the
// app is live: the player adopts the playing element and the queue is set exactly as it would have been, with the
// focus where it was. A pointer resting on a play button, or the focus reaching one, starts the work early. From then
// on the page is the app, as every page was before. A page that hydrates on load has no <noscript>, and this stays
// out of its way.
import { AUDIO_STARTED_ATTRIBUTE, HYDRATED_ATTRIBUTE, HYDRATED_EVENT, HYDRATE_ON_INTENT_ID, STREAM_BUFFER } from "../lib/hydration";
import { resumeAt, storedRate, storedVolume } from "../lib/player-storage";

const INTENT = "[data-play-intent]";
// React Router's sessionStorage key for its saved scroll positions (ScrollRestoration).
const SCROLL_POSITIONS = "react-router-scroll-positions";

type StreamBuffer = { chunks: string[]; closed: boolean };
type HandoffWindow = Window & {
  [STREAM_BUFFER]?: StreamBuffer;
  __reactRouterContext?: { streamController?: ReadableStreamDefaultController<string> };
};

let started = false;
let pending: { index: number; focused: boolean } | null = null;

const deferred = () => document.getElementById(HYDRATE_ON_INTENT_ID) !== null;
const hydrated = () => document.documentElement.hasAttribute(HYDRATED_ATTRIBUTE);

/** Hands the loader data the page streamed while it had no React to the stream React Router's script just made. */
function handOverStream() {
  const w = window as HandoffWindow;
  const buffer = w[STREAM_BUFFER];
  const controller = w.__reactRouterContext?.streamController;
  if (!buffer || !controller) return;
  for (const chunk of buffer.chunks) controller.enqueue(chunk);
  if (buffer.closed) controller.close();
}

/**
 * The page's position is where the reader is now: ScrollRestoration, mounting as the page hydrates, would otherwise
 * restore one saved for this history entry on an earlier visit and move the page under the reader's hand.
 */
function forgetSavedScroll() {
  try {
    const saved = sessionStorage.getItem(SCROLL_POSITIONS);
    if (!saved) return;
    const positions = JSON.parse(saved) as Record<string, number>;
    delete positions[(history.state as { key?: string } | null)?.key ?? "default"];
    sessionStorage.setItem(SCROLL_POSITIONS, JSON.stringify(positions));
  } catch {
    /* storage blocked: nothing was saved either */
  }
}

/** Runs the held hydration scripts in order: the module preloads, React Router's context, then its module script. */
function start(nonce: string) {
  const holder = document.getElementById(HYDRATE_ON_INTENT_ID);
  if (started || !holder) return;
  started = true;
  forgetSavedScroll();
  const parsed = document.createElement("template");
  parsed.innerHTML = holder.textContent ?? "";
  for (const node of Array.from(parsed.content.children)) {
    if (node instanceof HTMLLinkElement) {
      const link = node.cloneNode() as HTMLLinkElement;
      link.removeAttribute("nonce");
      document.head.appendChild(link);
      continue;
    }
    if (!(node instanceof HTMLScriptElement)) continue;
    // A script parsed as markup never runs; a new element with the same text does.
    const script = document.createElement("script");
    for (const { name, value } of Array.from(node.attributes)) if (name !== "nonce") script.setAttribute(name, value);
    if (nonce) script.nonce = nonce;
    script.textContent = node.textContent;
    document.body.appendChild(script);
    // A classic inline script runs as it is added: after the context script, the stream it made is there to fill.
    if (!script.type) handOverStream();
  }
}

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

/**
 * A pointer resting on a play button, or the focus reaching one, readies the press: the app starts loading, and the
 * episode's metadata (and resume position) loads on the idle element, so a press plays at once.
 */
function warm(event: Event, nonce: string) {
  if (hydrated() || !(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLElement>(INTENT);
  if (!button) return;
  const audio = document.querySelector("audio");
  if (audio && audio.paused) load(audio, button);
  start(nonce);
}

export function enhanceHydrateOnIntent(nonce: string) {
  if (!deferred()) return;
  document.addEventListener(
    "click",
    (event) => {
      if (hydrated() || !(event.target instanceof Element)) return;
      const button = event.target.closest<HTMLElement>(INTENT);
      if (!button) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      pending = playNow(button)
        ? { index: Array.from(document.querySelectorAll(INTENT)).indexOf(button), focused: document.activeElement === button }
        : null;
      start(nonce);
    },
    true,
  );
  document.addEventListener("pointerover", (event) => warm(event, nonce));
  document.addEventListener("focusin", (event) => warm(event, nonce));
  document.addEventListener(HYDRATED_EVENT, () => {
    if (!pending) return;
    const { index, focused } = pending;
    pending = null;
    // Found again by position: hydration keeps the server's elements, but a render it had to redo would not.
    const button = document.querySelectorAll<HTMLElement>(INTENT)[index];
    if (!button) return;
    if (focused) button.focus();
    button.click();
  });
}
