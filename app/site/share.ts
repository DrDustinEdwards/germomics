// The copy and share buttons (CopyButton in components/content/CopyLink.tsx): `data-copy` is the path to copy, and
// `data-share` offers the Web Share sheet where the device has one. The button shows "Copied" or "Copy failed" for a
// moment, and the role="status" region after it says the same (app/lib/copy-status.ts).
import {
  announceable,
  COPY_MESSAGE,
  shareOrCopy,
  SHOWN_MS,
  type CopyOutcome,
} from "~/lib/copy-status";

const timers = new WeakMap<Element, ReturnType<typeof setTimeout>>();

function show(button: Element, outcome: CopyOutcome | null) {
  for (const el of button.querySelectorAll<HTMLElement>("[data-copy-idle]"))
    el.hidden = outcome !== null;
  for (const el of button.querySelectorAll<HTMLElement>("[data-copy-done]"))
    el.hidden = outcome !== "copied";
  for (const el of button.querySelectorAll<HTMLElement>("[data-copy-failed]"))
    el.hidden = outcome !== "failed";
}

function report(button: Element, outcome: CopyOutcome) {
  const status = button.nextElementSibling?.matches("[data-copy-status]")
    ? button.nextElementSibling
    : null;
  clearTimeout(timers.get(button));
  show(button, outcome);
  if (status) {
    status.textContent = "";
    requestAnimationFrame(() => (status.textContent = announceable(COPY_MESSAGE[outcome])));
  }
  timers.set(
    button,
    setTimeout(() => {
      show(button, null);
      if (status) status.textContent = "";
    }, SHOWN_MS[outcome]),
  );
}

async function onClick(event: MouseEvent) {
  const button =
    event.target instanceof Element ? event.target.closest<HTMLElement>("[data-copy]") : null;
  if (!button) return;
  const result = await shareOrCopy(
    `${location.origin}${button.dataset.copy ?? ""}`,
    button.hasAttribute("data-share"),
  );
  if (result === "copied" || result === "failed") report(button, result);
}

export function enhanceShare() {
  document.addEventListener("click", (event) => void onClick(event));
}
