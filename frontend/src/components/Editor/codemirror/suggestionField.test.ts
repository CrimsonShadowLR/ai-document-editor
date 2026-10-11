import { EditorState, type TransactionSpec } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import { changesOf, diffSegments } from "../diff/diffSegments";
import {
  closeSuggestion,
  openSuggestion,
  resolveChange,
  setSuggestionPhase,
  showSuggestionDiff,
  suggestionExtension,
  suggestionField,
} from "./suggestionField";

const DOC = "Intro. Old words here. Outro.";
const FROM = DOC.indexOf("Old");
const TO = FROM + "Old words here.".length;

/** A state with a suggestion open on "Old words here." */
function openState() {
  const state = EditorState.create({ doc: DOC, extensions: suggestionExtension });
  return state.update({ effects: openSuggestion.of({ from: FROM, to: TO }) }).state;
}

function apply(state: EditorState, spec: TransactionSpec) {
  return state.update(spec).state;
}

describe("suggestionField", () => {
  it("opens in the loading phase on the given range", () => {
    expect(openState().field(suggestionField)).toEqual({ from: FROM, to: TO, phase: "loading", segments: null });
  });

  it("moves the range with edits made before it", () => {
    const state = apply(openState(), { changes: { from: 0, insert: "New " } });

    expect(state.field(suggestionField)).toMatchObject({ from: FROM + 4, to: TO + 4 });
  });

  it("keeps text typed right at either edge outside the range", () => {
    let state = apply(openState(), { changes: { from: FROM, insert: "<" } });
    const range = state.field(suggestionField)!;
    state = apply(state, { changes: { from: range.to, insert: ">" } });

    const after = state.field(suggestionField)!;
    expect(state.sliceDoc(after.from, after.to)).toBe("Old words here.");
  });

  it("blocks typing inside the open range", () => {
    const state = apply(openState(), { changes: { from: FROM + 2, insert: "XYZ" } });

    expect(state.doc.toString()).toBe(DOC);
    expect(state.field(suggestionField)).toMatchObject({ from: FROM, to: TO });
  });

  it("closes the suggestion when an unfiltered change (undo/redo) rewrites its text", () => {
    const state = apply(openState(), {
      changes: { from: 0, to: DOC.length, insert: "Something else entirely." },
      filter: false,
    });

    expect(state.field(suggestionField)).toBeNull();
  });

  it("shows the diff and records per-change decisions", () => {
    const segments = diffSegments("Old words here.", "New words here.");
    let state = apply(openState(), { effects: showSuggestionDiff.of(segments) });
    expect(state.field(suggestionField)?.phase).toBe("ready");

    const [change] = changesOf(state.field(suggestionField)!.segments!);
    state = apply(state, { effects: resolveChange.of({ id: change.id, status: "accepted" }) });

    expect(changesOf(state.field(suggestionField)!.segments!).map((c) => c.status)).toEqual(["accepted"]);
  });

  it("resolves every pending change at once when no id is given", () => {
    const segments = diffSegments("alpha one two three omega", "ALPHA one two three OMEGA");
    let state = EditorState.create({ doc: "alpha one two three omega", extensions: suggestionExtension });
    state = apply(state, { effects: [openSuggestion.of({ from: 0, to: state.doc.length }), showSuggestionDiff.of(segments)] });
    state = apply(state, { effects: resolveChange.of({ id: null, status: "rejected" }) });

    expect(changesOf(state.field(suggestionField)!.segments!).every((c) => c.status === "rejected")).toBe(true);
  });

  it("drops the old diff when a new request starts (refine/retry)", () => {
    let state = apply(openState(), { effects: showSuggestionDiff.of(diffSegments("Old words here.", "New words.")) });
    state = apply(state, { effects: setSuggestionPhase.of("loading") });

    expect(state.field(suggestionField)).toMatchObject({ phase: "loading", segments: null });
  });

  it("closes", () => {
    expect(apply(openState(), { effects: closeSuggestion.of(null) }).field(suggestionField)).toBeNull();
  });
});
