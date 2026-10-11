import { useCallback, useEffect, useState } from "react";

import { readStorage, writeStorage } from "../../../shared/storage";
import type { HistoryEntry } from "../schema/history";

const STORAGE_KEY = "editor.history";
/** Full-document snapshots add up; keep the newest ones only. */
const MAX_ENTRIES = 30;

type NewEntry = Omit<HistoryEntry, "id" | "at">;

/** The version timeline, newest first, persisted in localStorage. */
export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>(() => readStorage(STORAGE_KEY, []));

  useEffect(() => {
    writeStorage(STORAGE_KEY, entries);
  }, [entries]);

  /** Record a step. `baseline` is saved first if the timeline is still empty. */
  const record = useCallback((entry: NewEntry, baseline?: string) => {
    setEntries((current) => {
      const stamp = (fields: NewEntry): HistoryEntry => ({
        ...fields,
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
      });
      const next = [stamp(entry), ...current];
      if (current.length === 0 && baseline !== undefined) {
        next.push(stamp({ kind: "baseline", label: "Before AI edits", document: baseline }));
      }
      return next.slice(0, MAX_ENTRIES);
    });
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  return { entries, record, clear };
}
