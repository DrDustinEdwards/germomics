// The React side of app/lib/copy-status.ts: the outcome and its words to show on the button, and
// the text for the role="status" region beside it.
import { useCallback, useEffect, useRef, useState } from "react";
import { announceable, COPY_MESSAGE, SHOWN_MS, type CopyOutcome } from "./copy-status";

export function useCopyFeedback() {
  const [outcome, setOutcome] = useState<CopyOutcome | null>(null);
  const [label, setLabel] = useState("");
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const report = useCallback((result: CopyOutcome, text: string = COPY_MESSAGE[result]) => {
    clearTimeout(timer.current);
    setOutcome(result);
    setLabel(text);
    setMessage("");
    // Emptied first, then written on the next frame, so a repeat is a change the reader hears.
    requestAnimationFrame(() => setMessage(announceable(text)));
    timer.current = setTimeout(() => {
      setOutcome(null);
      setMessage("");
    }, SHOWN_MS[result]);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { outcome, label, message, report };
}
