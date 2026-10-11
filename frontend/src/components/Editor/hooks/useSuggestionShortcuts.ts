import { useEffect, useRef } from "react";

import type { SuggestionState } from "./useSuggestion";

interface ShortcutHandlers {
  status: SuggestionState["status"];
  popupVisible: boolean;
  focusPopupInput: () => void;
  acceptAll: () => void;
  rejectAll: () => void;
  close: () => void;
}

/**
 * Ctrl/⌘+Enter accepts all, Esc rejects (or cancels / dismisses), Ctrl/⌘+K
 * jumps to the popup's instruction box. Listens in the capture phase so it
 * runs before CodeMirror's own keymap (Ctrl+Enter there inserts a line).
 */
export function useSuggestionShortcuts(handlers: ShortcutHandlers) {
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { status, popupVisible, focusPopupInput, acceptAll, rejectAll, close } = handlersRef.current;
      const mod = event.ctrlKey || event.metaKey;
      let handled = true;

      if (mod && event.key === "Enter" && status === "ready") acceptAll();
      else if (event.key === "Escape" && status === "ready") rejectAll();
      else if (event.key === "Escape" && (status === "loading" || status === "error")) close();
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
