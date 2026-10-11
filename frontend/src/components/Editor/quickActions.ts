export interface QuickAction {
  label: string;
  instruction: string;
}

/** One-click actions in the selection popup. The label is what the user sees;
 * the instruction is what the model gets. */
export const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Improve",
    instruction: "Improve the writing: make it clearer and more concise, and fix grammar and spelling.",
  },
  { label: "Shorter", instruction: "Make it shorter while keeping the meaning." },
  { label: "Formal", instruction: "Make the tone more formal and professional." },
];
