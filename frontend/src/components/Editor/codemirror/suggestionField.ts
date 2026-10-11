import { EditorState, StateEffect, StateField, type Range } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";

import {
  changesOf,
  resolveText,
  type ChangeSegment,
  type ChangeStatus,
  type Segment,
} from "../diff/diffSegments";

export type SuggestionPhase = "loading" | "ready" | "error";

/**
 * The open suggestion, kept in the editor state so its range moves with edits
 * made elsewhere. The original text stays in the document while the user
 * reviews; the diff is drawn on top of it with decorations.
 */
export interface SuggestionRange {
  from: number;
  to: number;
  phase: SuggestionPhase;
  /** Set once the AI answered: the original text split into reviewable changes. */
  segments: Segment[] | null;
}

export const openSuggestion = StateEffect.define<{ from: number; to: number }>();
export const setSuggestionPhase = StateEffect.define<SuggestionPhase>();
export const showSuggestionDiff = StateEffect.define<Segment[]>();
/** Decide one change (`id`) or every pending change (`id` null). */
export const resolveChange = StateEffect.define<{ id: number | null; status: ChangeStatus }>();
export const closeSuggestion = StateEffect.define<null>();

export const suggestionField = StateField.define<SuggestionRange | null>({
  create: () => null,
  update(range, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(openSuggestion)) {
        range = { ...effect.value, phase: "loading", segments: null };
      } else if (effect.is(closeSuggestion)) {
        range = null;
      } else if (range && effect.is(setSuggestionPhase)) {
        range = { ...range, phase: effect.value, segments: null };
      } else if (range && effect.is(showSuggestionDiff)) {
        range = { ...range, phase: "ready", segments: effect.value };
      } else if (range?.segments && effect.is(resolveChange)) {
        const { id, status } = effect.value;
        range = {
          ...range,
          segments: range.segments.map((segment) =>
            segment.kind === "change" && segment.status === "pending" && (id === null || segment.id === id)
              ? { ...segment, status }
              : segment,
          ),
        };
      }
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

/** Decide changes, and once none is pending write the result into the document. */
export function resolveChanges(view: EditorView, status: ChangeStatus, id: number | null = null) {
  view.dispatch({ effects: resolveChange.of({ id, status }) });
  const range = view.state.field(suggestionField);
  if (!range?.segments) return;
  const changes = changesOf(range.segments);
  if (changes.length === 0 || changes.some((change) => change.status === "pending")) return;

  const text = resolveText(range.segments);
  const changed = text !== view.state.sliceDoc(range.from, range.to);
  view.dispatch({
    // One transaction, so a single Ctrl+Z undoes the whole AI edit.
    changes: changed ? { from: range.from, to: range.to, insert: text } : [],
    selection: changed ? { anchor: range.from + text.length } : undefined,
    effects: closeSuggestion.of(null),
    userEvent: "input.ai",
    // Our own edit of the locked range.
    filter: false,
  });
}

/** Inline green text for a change's new words, with ✓ / ✕ while it's pending. */
class ChangeWidget extends WidgetType {
  private readonly change: ChangeSegment;

  constructor(change: ChangeSegment) {
    super();
    this.change = change;
  }

  eq(other: ChangeWidget) {
    return (
      other.change.id === this.change.id &&
      other.change.newText === this.change.newText &&
      other.change.status === this.change.status
    );
  }

  toDOM(view: EditorView) {
    const wrapper = document.createElement("span");
    wrapper.className = "cm-diff-change";
    if (this.change.newText) {
      const inserted = document.createElement("span");
      inserted.className = this.change.status === "accepted" ? "cm-diff-accepted" : "cm-diff-inserted";
      inserted.textContent = this.change.newText;
      wrapper.append(inserted);
    }
    if (this.change.status === "pending") {
      const controls = document.createElement("span");
      controls.className = "cm-diff-controls";
      controls.append(
        this.button("✓", "Accept this change", "accepted", view),
        this.button("✕", "Reject this change", "rejected", view),
      );
      wrapper.append(controls);
    }
    return wrapper;
  }

  private button(label: string, title: string, status: ChangeStatus, view: EditorView) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    button.className = `cm-diff-button cm-diff-button-${status}`;
    // Don't move the editor's cursor or focus.
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => resolveChanges(view, status, this.change.id));
    return button;
  }

  ignoreEvent() {
    // Let clicks reach our buttons instead of CodeMirror.
    return true;
  }
}

const PHASE_MARKS = {
  loading: Decoration.mark({ class: "cm-suggestion cm-suggestion-loading" }),
  ready: Decoration.mark({ class: "cm-suggestion cm-suggestion-ready" }),
  error: Decoration.mark({ class: "cm-suggestion cm-suggestion-error" }),
};
const DELETED_MARK = Decoration.mark({ class: "cm-diff-deleted" });

function diffDecorations(from: number, segments: Segment[]): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];
  let position = from;
  for (const segment of segments) {
    if (segment.kind === "same") {
      position += segment.text.length;
      continue;
    }
    const end = position + segment.oldText.length;
    const widget = new ChangeWidget(segment);
    if (segment.status === "pending") {
      if (end > position) decorations.push(DELETED_MARK.range(position, end));
      decorations.push(Decoration.widget({ widget, side: 1 }).range(end));
    } else if (segment.status === "accepted") {
      decorations.push(
        end > position
          ? Decoration.replace({ widget }).range(position, end)
          : Decoration.widget({ widget, side: 1 }).range(end),
      );
    }
    // Rejected: the original text simply shows again.
    position = end;
  }
  return decorations;
}

const suggestionDecorations = EditorView.decorations.compute([suggestionField], (state) => {
  const range = state.field(suggestionField);
  if (!range || range.from === range.to) return Decoration.none;
  const decorations = [PHASE_MARKS[range.phase].range(range.from, range.to)];
  if (range.segments) decorations.push(...diffDecorations(range.from, range.segments));
  return Decoration.set(decorations, true);
});

/** While a suggestion is open its text can't be edited, so the AI's answer
 * always applies to exactly the text it was asked about. Our own writes
 * bypass this with `filter: false`. */
const lockSuggestionRange = EditorState.changeFilter.of((transaction) => {
  const range = transaction.startState.field(suggestionField);
  return range ? [range.from, range.to] : true;
});

export const suggestionExtension = [suggestionField, suggestionDecorations, lockSuggestionRange];
