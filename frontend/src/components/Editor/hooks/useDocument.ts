import { useEffect, useState } from "react";

import { useDebouncedValue } from "../../../shared/useDebouncedValue";
import { readStorage, writeStorage } from "../../../shared/storage";
import { EXAMPLE_DOCUMENT } from "../exampleDocument";

const STORAGE_KEY = "editor.document";

/** The Markdown document, loaded from localStorage and autosaved while typing. */
export function useDocument() {
  const [content, setContent] = useState<string>(() => readStorage(STORAGE_KEY, EXAMPLE_DOCUMENT));
  const debounced = useDebouncedValue(content, 500);

  useEffect(() => {
    writeStorage(STORAGE_KEY, debounced);
  }, [debounced]);

  // Flush on tab close so the last keystrokes inside the debounce window survive.
  useEffect(() => {
    const flush = () => writeStorage(STORAGE_KEY, content);
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [content]);

  const isSaved = debounced === content;

  return { content, setContent, isSaved };
}
