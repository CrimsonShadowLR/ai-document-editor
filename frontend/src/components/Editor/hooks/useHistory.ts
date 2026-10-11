import { useCallback, useEffect, useState } from "react";

import { readStorage, writeStorage } from "../../../shared/storage";
import type { HistoryEntry } from "../schema/history";

const STORAGE_KEY = "editor.history";
const DROPPED_KEY = "editor.historyDropped";
/** Full-document snapshots add up; keep the newest ones only. */
export const MAX_HISTORY_ENTRIES = 100;

type NewEntry = Omit<HistoryEntry, "id" | "at">;

interface HistoryState {
  /** Newest first. */
  entries: HistoryEntry[];
  /** How many old versions the cap has removed, so the panel can say so. */
  dropped: number;
}

/** The version timeline, newest first, persisted in localStorage. */
export function useHistory() {
  const [state, setState] = useState<HistoryState>(() => ({
    entries: readStorage(STORAGE_KEY, []),
    dropped: readStorage(DROPPED_KEY, 0),
  }));

  useEffect(() => {
    writeStorage(STORAGE_KEY, state.entries);
    writeStorage(DROPPED_KEY, state.dropped);
  }, [state]);

  /** Record a step. `baseline` is saved first if the timeline is still empty. */
  const record = useCallback((entry: NewEntry, baseline?: string) => {
    setState((current) => {
      const stamp = (fields: NewEntry): HistoryEntry => ({
        ...fields,
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
      });
      const next = [stamp(entry), ...current.entries];
      if (current.entries.length === 0 && baseline !== undefined) {
        next.push(stamp({ kind: "baseline", label: "Before AI edits", document: baseline }));
      }
      return {
        entries: next.slice(0, MAX_HISTORY_ENTRIES),
        dropped: current.dropped + Math.max(0, next.length - MAX_HISTORY_ENTRIES),
      };
    });
  }, []);

  const clear = useCallback(() => setState({ entries: [], dropped: 0 }), []);

  return { entries: state.entries, dropped: state.dropped, record, clear };
}
