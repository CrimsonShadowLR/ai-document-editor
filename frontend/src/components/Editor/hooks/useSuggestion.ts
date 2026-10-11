import { useCallback, useEffect, useRef, useState } from "react";
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
  /** For a refine: the suggestion it builds on, shown again if the refine is cancelled. */
  previous: ReadyState | null;
}

type ReadyState = { status: "ready"; request: SuggestionRequest; result: SuggestionResponse };

export type SuggestionState =
  | { status: "idle" }
  | { status: "loading"; request: SuggestionRequest }
  | ReadyState
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

/** An AI edit that was written into the document (fully or partly accepted). */
export interface AppliedEdit {
  label: string;
  model: string;
  passageBefore: string;
  passageAfter: string;
  documentBefore: string;
  documentAfter: string;
}

/**
 * The one open AI suggestion. The request lifecycle lives here; the range and
 * the per-change decisions live in the editor state (`suggestionField`), which
 * this hook mirrors through `syncFromEditor`.
 */
export function useSuggestion(
  view: EditorView | null,
  model: string | null,
  onApplied: (edit: AppliedEdit) => void,
) {
  const [state, setState] = useState<SuggestionState>({ status: "idle" });
  // syncFromEditor runs inside CodeMirror updates; read the latest values via refs.
  const stateRef = useRef(state);
  const onAppliedRef = useRef(onApplied);
  useEffect(() => {
    stateRef.current = state;
    onAppliedRef.current = onApplied;
  });
  const [range, setRange] = useState<SuggestionRange | null>(null);
  const { mutateAsync } = useCreateSuggestion();
  // Bumped on every request and on close, so a late answer can't reopen a closed suggestion.
  const latestRequestId = useRef(0);
  // The request in flight, aborted when it's superseded or cancelled.
  const inFlight = useRef<AbortController | null>(null);

  /** Ignore and abort the request in flight, if any. */
  const dropRequest = useCallback(() => {
    latestRequestId.current++;
    inFlight.current?.abort();
    inFlight.current = null;
  }, []);

  useEffect(() => dropRequest, [dropRequest]);

  const run = useCallback(
    async (request: SuggestionRequest) => {
      if (!view) return;
      dropRequest();
      const requestId = latestRequestId.current;
      const controller = new AbortController();
      inFlight.current = controller;
      setState({ status: "loading", request });
      view.dispatch({ effects: setSuggestionPhase.of("loading") });
      try {
        const result = await mutateAsync({
          body: {
            before: request.before,
            selection: request.original,
            after: request.after,
            instruction: request.action.instruction,
            model,
            turns: request.turns,
          },
          signal: controller.signal,
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
    [view, model, mutateAsync, dropRequest],
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
        previous: null,
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
        previous: state,
      });
    },
    [state, run],
  );

  /** Close without touching the document (cancel, dismiss, nothing to change). */
  const close = useCallback(() => {
    view?.dispatch({ effects: closeSuggestion.of(null) });
    view?.focus();
  }, [view]);

  /**
   * Cancel a loading request or dismiss its error. A refine goes back to the
   * suggestion it was refining; a first request closes.
   */
  const cancel = useCallback(() => {
    const previous = state.status === "loading" || state.status === "error" ? state.request.previous : null;
    if (!view || !previous) return close();
    dropRequest();
    view.dispatch({
      effects: showSuggestionDiff.of(diffSegments(previous.request.original, previous.result.replacement)),
    });
    setState(previous);
    view.focus();
  }, [state, view, close, dropRequest]);

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

    const current = stateRef.current;
    const applied = update.transactions.find((transaction) => transaction.isUserEvent("input.ai"));
    if (applied?.docChanged && current.status === "ready") {
      applied.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
        onAppliedRef.current({
          label: [...current.request.previousLabels, current.request.action.label].join(" → "),
          model: current.result.model,
          passageBefore: update.startState.sliceDoc(fromA, toA),
          passageAfter: inserted.toString(),
          documentBefore: update.startState.doc.toString(),
          documentAfter: update.state.doc.toString(),
        });
      });
    }

    if (!next) {
      dropRequest();
      setState({ status: "idle" });
    }
  }, [dropRequest]);

  return { state, range, request, retry, refine, close, cancel, acceptAll, rejectAll, syncFromEditor };
}
