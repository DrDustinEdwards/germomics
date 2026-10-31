// Hydrate on intent: a public page sends no React (lib/hydration.ts), but its play buttons need the player, whose one
// <audio> element keeps playing while client-side navigation changes the page around it. So the first press of a play
// button (data-play-intent, components/content/PlayButton.tsx) runs React Router's hydration scripts, which the page
// holds as text in a <noscript>, and is handed to the button once the app is live: the queue starts exactly as it
// would have, with the focus where it was. A pointer resting on a play button starts the work early. From then on the
// page is the app, as every page was before. A page that hydrates on load has no <noscript>, and this stays out of
// its way.
import { HYDRATED_ATTRIBUTE, HYDRATED_EVENT, HYDRATE_ON_INTENT_ID, STREAM_BUFFER } from "../lib/hydration";

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

/** A press the page cannot play yet: unlocks the <audio> element while the press is still a user gesture, since
 * Safari plays a media element later only if a gesture played it first. */
function unlockAudio(button: HTMLElement) {
  const audio = document.querySelector("audio");
  const src = button.dataset.audioSrc;
  if (!audio || !src || audio.getAttribute("src")) return;
  audio.src = src;
  audio.play().catch(() => {});
  audio.pause();
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
      unlockAudio(button);
      pending = { index: Array.from(document.querySelectorAll(INTENT)).indexOf(button), focused: document.activeElement === button };
      start(nonce);
    },
    true,
  );
  document.addEventListener("pointerover", (event) => {
    if (!started && event.target instanceof Element && event.target.closest(INTENT)) start(nonce);
  });
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
