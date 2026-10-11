import { useEffect, useRef } from "react";

import type { SuggestionState } from "./useSuggestion";

interface ShortcutHandlers {
  status: SuggestionState["status"];
  popupVisible: boolean;
  focusPopupInput: () => void;
  dismissPopup: () => void;
  acceptAll: () => void;
  rejectAll: () => void;
  cancel: () => void;
}

/**
 * Ctrl/⌘+Enter accepts all, Esc rejects (or cancels / dismisses), Ctrl/⌘+K
 * jumps to the popup's instruction box. Listens in the capture phase so it
 * runs before CodeMirror's own keymap (Ctrl+Enter there inserts a line).
 * Enter and Esc typed in a text box (the popup's or the refine box) are left
 * to it, so Esc there doesn't throw the suggestion away.
 */
export function useSuggestionShortcuts(handlers: ShortcutHandlers) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const inTextBox = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (inTextBox && (event.key === "Enter" || event.key === "Escape")) return;
      const { status, popupVisible, focusPopupInput, dismissPopup, acceptAll, rejectAll, cancel } =
        handlersRef.current;
      const mod = event.ctrlKey || event.metaKey;
      let handled = true;

      if (mod && event.key === "Enter" && status === "ready") acceptAll();
      else if (event.key === "Escape" && status === "ready") rejectAll();
      else if (event.key === "Escape" && (status === "loading" || status === "error")) cancel();
      else if (event.key === "Escape" && popupVisible) dismissPopup();
      else if (mod && event.key.toLowerCase() === "k" && popupVisible) focusPopupInput();
      else handled = false;

      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);
}
