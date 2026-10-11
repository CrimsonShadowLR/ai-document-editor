/** One earlier round of the same suggestion (used by refine). */
export interface SuggestionTurn {
  instruction: string;
  replacement: string;
}

/** Wire shape of `POST /suggestions`. The document is split around the selection. */
export interface CreateSuggestionBody {
  before: string;
  selection: string;
  after: string;
  instruction: string;
  model: string | null;
  turns: SuggestionTurn[];
}

export interface SuggestionResponse {
  replacement: string;
  reason: string | null;
  model: string;
}
