// The header's two menus (components/chrome/Header.tsx). The Episodes dropdown: a disclosure button and a menu of
// links; ArrowDown on the button opens it on its first item, arrows, Home and End move between items, Escape closes it
// (from an item, focus returns to the button, as does ArrowUp from the first), and an outside press or a followed link
// closes it. The phone menu: one button that opens and closes the nav below the bar, its label and icon following.

const DROPDOWN = "[data-menu]";
const MOBILE_BUTTON = 'button[aria-controls="mobile-menu"]';

function parts(menu: Element) {
  return {
    button: menu.querySelector<HTMLButtonElement>("[data-menu-button]"),
    list: menu.querySelector<HTMLElement>('[role="menu"]'),
    chevron: menu.querySelector("[data-menu-chevron]"),
    items: Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]')),
  };
}

function isOpen(menu: Element) {
  return parts(menu).button?.getAttribute("aria-expanded") === "true";
}

function setOpen(menu: Element, open: boolean) {
  const { button, list, chevron } = parts(menu);
  button?.setAttribute("aria-expanded", String(open));
  if (list) list.hidden = !open;
  chevron?.classList.toggle("rotate-180", open);
}

function setMobileOpen(open: boolean) {
  const button = document.querySelector<HTMLButtonElement>(MOBILE_BUTTON);
  const nav = document.getElementById("mobile-menu");
  if (!button || !nav) return;
  button.setAttribute("aria-expanded", String(open));
  button.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  for (const icon of button.querySelectorAll("[data-menu-closed]")) icon.classList.toggle("hidden", open);
  for (const icon of button.querySelectorAll("[data-menu-open]")) icon.classList.toggle("hidden", !open);
  nav.hidden = !open;
}

function closeAll() {
  for (const menu of document.querySelectorAll(DROPDOWN)) setOpen(menu, false);
  setMobileOpen(false);
}

function onClick(event: MouseEvent) {
  if (!(event.target instanceof Element)) return;
  const target = event.target;
  const menu = target.closest(DROPDOWN);
  if (menu && target.closest("[data-menu-button]")) return setOpen(menu, !isOpen(menu));
  if (menu && target.closest('[role="menuitem"]')) return setOpen(menu, false);
  if (target.closest(MOBILE_BUTTON)) {
    return setMobileOpen(document.querySelector(MOBILE_BUTTON)?.getAttribute("aria-expanded") !== "true");
  }
  if (target.closest("#mobile-menu a")) setMobileOpen(false);
}

function onKeydown(event: KeyboardEvent) {
  if (!(event.target instanceof Element)) return;
  const target = event.target;
  const menu = target.closest(DROPDOWN);
  if (!menu) return;
  const { button, items } = parts(menu);
  if (target.closest("[data-menu-button]")) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(menu, true);
      requestAnimationFrame(() => items[0]?.focus());
    } else if (event.key === "Escape") {
      setOpen(menu, false);
    }
    return;
  }
  const at = items.indexOf(target as HTMLElement);
  if (at < 0) return;
  const focusItem = (i: number) => items[((i % items.length) + items.length) % items.length]?.focus();
  const close = () => {
    setOpen(menu, false);
    button?.focus();
  };
  if (event.key === "ArrowDown") {
    event.preventDefault();
    focusItem(at + 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    if (at === 0) close();
    else focusItem(at - 1);
  } else if (event.key === "Home") {
    event.preventDefault();
    focusItem(0);
  } else if (event.key === "End") {
    event.preventDefault();
    focusItem(items.length - 1);
  } else if (event.key === "Escape") {
    event.preventDefault();
    close();
  }
}

function onPointerdown(event: PointerEvent) {
  for (const menu of document.querySelectorAll(DROPDOWN)) {
    if (isOpen(menu) && !(event.target instanceof Node && menu.contains(event.target))) setOpen(menu, false);
  }
}

export function enhanceMenus() {
  document.addEventListener("click", onClick);
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("pointerdown", onPointerdown);
  // Back and forward in a hydrated page change the route with no click: the menus close, as on any route change.
  addEventListener("popstate", closeAll);
}
