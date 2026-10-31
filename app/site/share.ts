// The copy and share buttons (CopyButton in components/content/CopyLink.tsx): `data-copy` is the path to copy, and
// `data-share` offers the Web Share sheet where the device has one. A copy shows "Copied" for a moment.
const shown = new WeakMap<Element, ReturnType<typeof setTimeout>>();

function showCopied(button: Element, copied: boolean) {
  for (const el of button.querySelectorAll<HTMLElement>("[data-copy-idle]")) el.hidden = copied;
  for (const el of button.querySelectorAll<HTMLElement>("[data-copy-done]")) el.hidden = !copied;
}

export function enhanceShare() {
  document.addEventListener("click", async (event) => {
    const button = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-copy]") : null;
    if (!button) return;
    const url = `${location.origin}${button.dataset.copy ?? ""}`;
    try {
      if (button.hasAttribute("data-share") && navigator.share) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showCopied(button, true);
      clearTimeout(shown.get(button));
      shown.set(button, setTimeout(() => showCopied(button, false), 1800));
    } catch {
      /* dismissed or blocked */
    }
  });
}
