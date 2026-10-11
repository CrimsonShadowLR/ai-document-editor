import { useEffect, useState } from "react";

import { readStorage, writeStorage } from "../../../shared/storage";
import { EXAMPLE_DOCUMENT } from "../exampleDocument";

const STORAGE_KEY = "editor.document";
const SAVE_DELAY_MS = 500;

/** The Markdown document, loaded from localStorage and autosaved while typing. */
export function useDocument() {
  const [content, setContent] = useState<string>(() => readStorage(STORAGE_KEY, EXAMPLE_DOCUMENT));
  // The last content we tried to save, and whether the browser accepted it.
  const [lastSave, setLastSave] = useState({ content, ok: true });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLastSave({ content, ok: writeStorage(STORAGE_KEY, content) });
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [content]);

  // Flush on tab close so the last keystrokes inside the debounce window survive.
  useEffect(() => {
    const flush = () => writeStorage(STORAGE_KEY, content);
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [content]);

  const isSaved = lastSave.content === content;
  // Storage full or blocked (e.g. private mode): the document only lives in this tab.
  const saveFailed = !lastSave.ok;

  return { content, setContent, isSaved, saveFailed };
}
