import type { SuggestionFeature } from "./schema/suggestion";

export interface QuickAction {
  label: string;
  instruction: string;
  /** Which UI action this is, so the backend can break down usage and cost. */
  feature: SuggestionFeature;
}

/** One-click actions in the selection popup. The label is what the user sees;
 * the instruction is what the model gets. */
export const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Improve",
    instruction: "Improve the writing: make it clearer and more concise, and fix grammar and spelling.",
    feature: "improve",
  },
  { label: "Shorter", instruction: "Make it shorter while keeping the meaning.", feature: "shorter" },
  { label: "Formal", instruction: "Make the tone more formal and professional.", feature: "formal" },
];
