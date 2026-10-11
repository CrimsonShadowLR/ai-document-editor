import { useCallback, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";

import { errorMessage } from "../../../shared/httpClient";
import {
  closeSuggestion,
  openSuggestion,
  setSuggestionPhase,
  suggestionField,
} from "../codemirror/suggestionField";
import type { QuickAction } from "../quickActions";
import type { SuggestionResponse } from "../schema/suggestion";
import { useCreateSuggestion } from "./useCreateSuggestion";

/** What was asked, kept so a failed request can be retried as-is. */
interface SuggestionRequest {
  action: QuickAction;
  before: string;
  original: string;
  after: string;
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
 * The one open AI suggestion: ask for it on the current selection, then
 * accept or reject it. The editor keeps the range locked meanwhile.
 */
export function useSuggestion(view: EditorView | null, model: string | null) {
  const [state, setState] = useState<SuggestionState>({ status: "idle" });
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
          turns: [],
        });
        if (requestId !== latestRequestId.current) return;
        view.dispatch({ effects: setSuggestionPhase.of("ready") });
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
      const { from, to } = trimRange(
        doc.sliceString(selection.from, selection.to),
        selection.from,
        selection.to,
      );
      if (from === to) return;
      view.dispatch({ effects: openSuggestion.of({ from, to, phase: "loading" }) });
      void run({
        action,
        before: doc.sliceString(0, from),
        original: doc.sliceString(from, to),
        after: doc.sliceString(to),
      });
    },
    [view, run],
  );

  const retry = useCallback(() => {
    if (state.status === "error") void run(state.request);
  }, [state, run]);

  const close = useCallback(() => {
    latestRequestId.current++;
    setState({ status: "idle" });
    view?.dispatch({ effects: closeSuggestion.of(null) });
    view?.focus();
  }, [view]);

  /** Replace the range with the suggestion in one undoable step. */
  const accept = useCallback(() => {
    if (!view || state.status !== "ready") return;
    const range = view.state.field(suggestionField);
    if (!range) return;
    const replacement = state.result.replacement;
    view.dispatch({
      changes: { from: range.from, to: range.to, insert: replacement },
      selection: { anchor: range.from + replacement.length },
      effects: closeSuggestion.of(null),
      // Our own edit of the locked range.
      filter: false,
    });
    latestRequestId.current++;
    setState({ status: "idle" });
    view.focus();
  }, [view, state]);

  return { state, request, retry, accept, reject: close };
}
