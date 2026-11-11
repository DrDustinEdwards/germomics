// Hydrate on intent: a public page sends no React (lib/hydration.ts), but its play buttons need the player, whose one
// <audio> element keeps playing while client-side navigation changes the page around it. So the first press of a play
// button (data-play-intent, Capsomer's PlayTrackButton) starts the audio at once, inside the press, then runs
// React Router's hydration scripts, which the page holds as text in a <noscript>, and is handed to the button once the
// app is live: the player adopts the playing element and the queue is set exactly as it would have been, with the
// focus where it was. A pointer resting on a play button, or the focus reaching one, starts the work early. From then
// on the page is the app, as every page was before. A page that hydrates on load has no <noscript>, and this stays
// out of its way.
import {
  HYDRATED_ATTRIBUTE,
  HYDRATED_EVENT,
  HYDRATE_ON_INTENT_ID,
  STREAM_BUFFER,
} from "../lib/hydration";
import { trustedHtml } from "capsomer/behavior/trusted-html";
import { AUDIO_SELECTOR, loadTrack, playerStorage, startTrack } from "capsomer/behavior/player";

const INTENT = "[data-play-intent]";
// React Router's sessionStorage key for its saved scroll positions (ScrollRestoration).
const SCROLL_POSITIONS = "react-router-scroll-positions";

type StreamBuffer = { chunks: string[]; closed: boolean };
type HandoffWindow = Window & {
  [STREAM_BUFFER]?: StreamBuffer;
  __reactRouterContext?: { streamController?: ReadableStreamDefaultController<string> };
};

let started = false;

type ScriptPolicy = { createScript(text: string): unknown };
let scriptPolicy: ScriptPolicy | null | undefined;

/**
 * A held hydration script's text as TrustedScript, under the "germomics-hydrate" policy (its name is in the page's
 * `trusted-types` list, security-headers.ts). The policy object stays in this module and is used only by `start`,
 * on the text of React Router's own scripts that our server rendered into the page's <noscript>, never on anything
 * a reader wrote. Without Trusted Types, or before the policy is allowed, the plain text.
 */
function trustedScript(text: string): string {
  if (scriptPolicy === undefined) {
    try {
      const types = (
        globalThis as { trustedTypes?: { createPolicy(n: string, r: object): ScriptPolicy } }
      ).trustedTypes;
      scriptPolicy =
        types?.createPolicy("germomics-hydrate", { createScript: (s: string) => s }) ?? null;
    } catch {
      scriptPolicy = null;
    }
  }
  return (scriptPolicy?.createScript(text) ?? text) as string;
}
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
  parsed.innerHTML = trustedHtml(holder.textContent ?? "");
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
    for (const { name, value } of Array.from(node.attributes))
      if (name !== "nonce") script.setAttribute(name, value);
    if (nonce) script.nonce = nonce;
    script.text = trustedScript(node.textContent ?? "");
    document.body.appendChild(script);
    // A classic inline script runs as it is added: after the context script, the stream it made is there to fill.
    if (!script.type) handOverStream();
  }
}

// What the player remembers (rate, volume, mute, each episode's position), read the same way the player reads it, so a
// press before React sounds and resumes as one after it.
const storage = playerStorage("germomics-");

/** The pressed button's episode (PlayTrackButton's data-audio-src and data-track-id), as the <audio> element needs it. */
function trackOf(button: HTMLElement): { id: string; src: string } | null {
  const src = button.dataset.audioSrc;
  return src ? { id: button.dataset.trackId ?? src, src } : null;
}

/**
 * A pointer resting on a play button, or the focus reaching one, readies the press: the app starts loading, and the
 * episode's metadata (and resume position) loads on the idle element, so a press plays at once.
 */
function warm(event: Event, nonce: string) {
  if (hydrated() || !(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLElement>(INTENT);
  if (!button) return;
  const audio = document.querySelector<HTMLAudioElement>(AUDIO_SELECTOR);
  const track = trackOf(button);
  if (audio && track && audio.paused) loadTrack(audio, track, storage);
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
      // Played inside the press itself, since Safari and iOS refuse a play() that comes later, after React has loaded.
      // Pressing the same playing episode again before React is live pauses it, and then the press needs no app.
      const audio = document.querySelector<HTMLAudioElement>(AUDIO_SELECTOR);
      const track = trackOf(button);
      pending =
        !audio || !track || startTrack(audio, track, storage)
          ? {
              index: Array.from(document.querySelectorAll(INTENT)).indexOf(button),
              focused: document.activeElement === button,
            }
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
