/** One version of the document in the history timeline. */
export interface HistoryEntry {
  id: string;
  /** ISO timestamp. */
  at: string;
  /** "Improve → Shorter", "Before AI edits", "Restored 12:03". */
  label: string;
  kind: "baseline" | "ai-edit" | "restore";
  /** The full document after this step. */
  document: string;
  /** For AI edits: the model and the passage before/after, to show what changed. */
  model?: string;
  passageBefore?: string;
  passageAfter?: string;
}
