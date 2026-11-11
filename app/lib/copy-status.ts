// Copy and share buttons: one way to copy, and one way to say what happened, for the React buttons
// (CopyLink.tsx ShareButton, TranscriptPanel.tsx) and the server-rendered ones /site.js wires
// (app/site/share.ts). A copy can fail (the clipboard refused, no secure context), so every button
// shows "Copied" or "Copy failed" and says it in a role="status" region beside the button, outside
// it, because a live region inside a button is not reliably announced (Modern Web Guidance
// "copy-button"). No React here: /site.js bundles this file; the hook is use-copy-feedback.ts.
export type CopyOutcome = "copied" | "failed";

export const COPY_MESSAGE: Record<CopyOutcome, string> = {
  copied: "Copied",
  failed: "Copy failed",
};

// A success is short news; a failure stays long enough to read and copy by hand.
export const SHOWN_MS: Record<CopyOutcome, number> = { copied: 2000, failed: 6000 };

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// The Web Share sheet where asked for and the device has one, else the clipboard. Closing the
// sheet is the reader's choice, not a failure; any other share error falls back to copying.
export async function shareOrCopy(
  url: string,
  share: boolean,
): Promise<CopyOutcome | "shared" | "dismissed"> {
  if (share && typeof navigator.share === "function") {
    try {
      await navigator.share({ url });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "dismissed";
    }
  }
  return (await copyText(url)) ? "copied" : "failed";
}

// VoiceOver skips a message equal to the last one from a region; a no-break space makes it differ.
let lastMessage = "";
export function announceable(message: string): string {
  const text = message === lastMessage ? `${message} ` : message;
  lastMessage = text;
  return text;
}
