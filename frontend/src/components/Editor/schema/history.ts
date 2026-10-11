/** One version of the document in the history timeline. */
export interface HistoryEntry {
  id: string;
  /** ISO timestamp. */
  at: string;
  /** "Improve → Shorter", "Before AI edits", "Restored version from 12:03". */
  label: string;
  /** "edits": the user's own changes, saved before a restore replaced them. */
  kind: "baseline" | "ai-edit" | "restore" | "edits";
  /** The full document after this step. */
  document: string;
  /** For AI edits: the model and the passage before/after, to show what changed. */
  model?: string;
  passageBefore?: string;
  passageAfter?: string;
}
