// A native modal <dialog> driven by React: the component mounts the dialog while it should be open,
// and this opens it with showModal() and reports every close (Esc, the back gesture, a backdrop
// click, a close button) once. The browser supplies the inert page, the focus trap, the top layer
// and focus back to the opener, so no component here writes those by hand (Modern Web Guidance
// "dialog" and "light-dismiss-a-dialog"). A backdrop click closes it through closedby="any" where
// the browser has it, and through the click test below where it does not (Safari).
import { useEffectEvent, useLayoutEffect, useRef } from "react";

const hasClosedBy = () =>
  typeof HTMLDialogElement !== "undefined" && "closedBy" in HTMLDialogElement.prototype;

// Outside the dialog's box: the backdrop. The dialog is also the target for its own padding, so
// the pointer position decides, not event.target.
function outside(e: PointerEvent, dialog: HTMLDialogElement): boolean {
  const r = dialog.getBoundingClientRect();
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
}

export function useModalDialog(onClose: () => void) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const closed = useEffectEvent(onClose);

  // A layout effect, so the cleanup closes the dialog before React takes it out of the document.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // The close event is queued: one from a cleanup's close() can arrive after the dialog opened
    // again (React's development double mount), so only a dialog that is still closed reports.
    const onDialogClose = () => {
      if (!dialog.open) closed();
    };
    dialog.addEventListener("close", onDialogClose);
    // Press and release both outside, so a text selection dragged onto the backdrop keeps it open.
    let pressedOutside = false;
    const onDown = (e: PointerEvent) => (pressedOutside = outside(e, dialog));
    const onUp = (e: PointerEvent) => {
      if (pressedOutside && outside(e, dialog)) dialog.close();
    };
    if (!hasClosedBy()) {
      dialog.addEventListener("pointerdown", onDown);
      dialog.addEventListener("pointerup", onUp);
    }
    if (!dialog.open) dialog.showModal();
    return () => {
      dialog.removeEventListener("close", onDialogClose);
      dialog.removeEventListener("pointerdown", onDown);
      dialog.removeEventListener("pointerup", onUp);
      // Closed while still in the document, so the browser hands focus back to the opener.
      if (dialog.open) dialog.close();
    };
  }, []);

  return ref;
}
