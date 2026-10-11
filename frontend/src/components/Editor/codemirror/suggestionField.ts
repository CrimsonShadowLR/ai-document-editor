import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";

export type SuggestionPhase = "loading" | "ready" | "error";

/** The document range an open suggestion is about. Lives in the editor state so
 * it moves with edits made elsewhere in the document. */
export interface SuggestionRange {
  from: number;
  to: number;
  phase: SuggestionPhase;
}

export const openSuggestion = StateEffect.define<SuggestionRange>();
export const setSuggestionPhase = StateEffect.define<SuggestionPhase>();
export const closeSuggestion = StateEffect.define<null>();

export const suggestionField = StateField.define<SuggestionRange | null>({
  create: () => null,
  update(range, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(openSuggestion)) return effect.value;
      if (effect.is(closeSuggestion)) return null;
      if (effect.is(setSuggestionPhase) && range) range = { ...range, phase: effect.value };
    }
    if (!range || !transaction.docChanged) return range;
    // Text typed right at either edge stays outside the range.
    return {
      ...range,
      from: transaction.changes.mapPos(range.from, 1),
      to: transaction.changes.mapPos(range.to, -1),
    };
  },
});

const PHASE_MARKS = {
  loading: Decoration.mark({ class: "cm-suggestion cm-suggestion-loading" }),
  ready: Decoration.mark({ class: "cm-suggestion" }),
  error: Decoration.mark({ class: "cm-suggestion cm-suggestion-error" }),
};

const suggestionDecorations = EditorView.decorations.compute([suggestionField], (state) => {
  const range = state.field(suggestionField);
  if (!range || range.from === range.to) return Decoration.none;
  return Decoration.set([PHASE_MARKS[range.phase].range(range.from, range.to)]);
});

/** While a suggestion is open its text can't be edited, so the AI's answer
 * always applies to exactly the text it was asked about. Accepting bypasses
 * this with `filter: false`. */
const lockSuggestionRange = EditorState.changeFilter.of((transaction) => {
  const range = transaction.startState.field(suggestionField);
  return range ? [range.from, range.to] : true;
});

export const suggestionExtension = [suggestionField, suggestionDecorations, lockSuggestionRange];
