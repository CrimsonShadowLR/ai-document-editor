import { useCallback, useRef, useState } from "react";
import type { EditorView, ViewUpdate } from "@codemirror/view";

import { errorMessage } from "../../../shared/httpClient";
import {
  closeSuggestion,
  openSuggestion,
  resolveChanges,
  setSuggestionPhase,
  showSuggestionDiff,
  suggestionField,
  type SuggestionRange,
} from "../codemirror/suggestionField";
import { diffSegments } from "../diff/diffSegments";
import type { QuickAction } from "../quickActions";
import type { SuggestionResponse, SuggestionTurn } from "../schema/suggestion";
import { useCreateSuggestion } from "./useCreateSuggestion";

/** The backend accepts at most this many earlier rounds. */
export const MAX_REFINE_TURNS = 10;

/** What was asked, kept so a failed request can be retried as-is. */
interface SuggestionRequest {
  action: QuickAction;
  before: string;
  original: string;
  after: string;
  /** Earlier rounds of this suggestion, oldest first (refine). */
  turns: SuggestionTurn[];
  /** Labels of the earlier rounds, for the "Improve → Shorter" trail. */
  previousLabels: string[];
}

export type SuggestionState =
  | { status: "idle" }
  | { status: "loading"; request: SuggestionRequest }
  | { status: "ready"; request: SuggestionRequest; result: SuggestionResponse }
  | { status: "error"; request: SuggestionRequest; error: string };

/**
 * Shrink a range so it doesn't start or end with whitespace. A triple-click
 * selects the trailing newline too; the model drops it, and accepting would
 * then glue the paragraph to the next one.
 */
function trimRange(selected: string, from: number, to: number) {
  const leading = selected.length - selected.trimStart().length;
  const trailing = selected.length - selected.trimEnd().length;
  return leading === selected.length ? { from, to: from } : { from: from + leading, to: to - trailing };
}

/**
 * The one open AI suggestion. The request lifecycle lives here; the range and
 * the per-change decisions live in the editor state (`suggestionField`), which
 * this hook mirrors through `syncFromEditor`.
 */
export function useSuggestion(view: EditorView | null, model: string | null) {
  const [state, setState] = useState<SuggestionState>({ status: "idle" });
  const [range, setRange] = useState<SuggestionRange | null>(null);
  const { mutateAsync } = useCreateSuggestion();
  // Bumped on every request and on close, so a late answer can't reopen a closed suggestion.
  const latestRequestId = useRef(0);

  const run = useCallback(
    async (request: SuggestionRequest) => {
      if (!view) return;
      const requestId = ++latestRequestId.current;
      setState({ status: "loading", request });
      view.dispatch({ effects: setSuggestionPhase.of("loading") });
      try {
        const result = await mutateAsync({
          before: request.before,
          selection: request.original,
          after: request.after,
          instruction: request.action.instruction,
          model,
          turns: request.turns,
        });
        if (requestId !== latestRequestId.current) return;
        view.dispatch({ effects: showSuggestionDiff.of(diffSegments(request.original, result.replacement)) });
        setState({ status: "ready", request, result });
      } catch (error) {
        if (requestId !== latestRequestId.current) return;
        view.dispatch({ effects: setSuggestionPhase.of("error") });
        setState({ status: "error", request, error: errorMessage(error, "The AI request failed.") });
      }
    },
    [view, model, mutateAsync],
  );

  /** Ask the AI about the current selection. */
  const request = useCallback(
    (action: QuickAction) => {
      if (!view) return;
      const doc = view.state.doc;
      const selection = view.state.selection.main;
      const { from, to } = trimRange(doc.sliceString(selection.from, selection.to), selection.from, selection.to);
      if (from === to) return;
      // Collapse the selection so its highlight doesn't cover the diff.
      view.dispatch({ effects: openSuggestion.of({ from, to }), selection: { anchor: to } });
      void run({
        action,
        before: doc.sliceString(0, from),
        original: doc.sliceString(from, to),
        after: doc.sliceString(to),
        turns: [],
        previousLabels: [],
      });
    },
    [view, run],
  );

  const retry = useCallback(() => {
    if (state.status === "error") void run(state.request);
  }, [state, run]);

  /**
   * Follow-up on the current suggestion ("now shorter"). The model sees the
   * earlier rounds; the new diff is still against the original text, which is
   * what the document holds. Decisions on the old diff are dropped.
   */
  const refine = useCallback(
    (instruction: string) => {
      if (state.status !== "ready" || state.request.turns.length >= MAX_REFINE_TURNS) return;
      const { request: previous, result } = state;
      void run({
        ...previous,
        action: { label: instruction, instruction },
        turns: [...previous.turns, { instruction: previous.action.instruction, replacement: result.replacement }],
        previousLabels: [...previous.previousLabels, previous.action.label],
      });
    },
    [state, run],
  );

  /** Close without touching the document (cancel, dismiss, nothing to change). */
  const close = useCallback(() => {
    view?.dispatch({ effects: closeSuggestion.of(null) });
    view?.focus();
  }, [view]);

  const acceptAll = useCallback(() => {
    if (view) resolveChanges(view, "accepted");
    view?.focus();
  }, [view]);

  const rejectAll = useCallback(() => {
    if (view) resolveChanges(view, "rejected");
    view?.focus();
  }, [view]);

  /** Mirror the editor's suggestion range; when the editor closes it, so do we. */
  const syncFromEditor = useCallback((update: ViewUpdate) => {
    const next = update.state.field(suggestionField);
    if (next === update.startState.field(suggestionField)) return;
    setRange(next);
    if (!next) {
      latestRequestId.current++;
      setState({ status: "idle" });
    }
  }, []);

  return { state, range, request, retry, refine, close, acceptAll, rejectAll, syncFromEditor };
}
