/** One earlier round of the same suggestion (used by refine). */
export interface SuggestionTurn {
  instruction: string;
  replacement: string;
}

/** Which UI action started a request (mirrors the backend's SuggestionFeature). */
export type SuggestionFeature = "improve" | "shorter" | "formal" | "custom" | "refine";

/** Wire shape of `POST /suggestions`. The document is split around the selection. */
export interface CreateSuggestionBody {
  before: string;
  selection: string;
  after: string;
  instruction: string;
  model: string | null;
  turns: SuggestionTurn[];
  feature: SuggestionFeature;
}

export interface SuggestionResponse {
  replacement: string;
  reason: string | null;
  model: string;
}
