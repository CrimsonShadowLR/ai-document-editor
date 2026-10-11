import { useCallback, useState, type RefObject } from "react";
import type { EditorView, ViewUpdate } from "@codemirror/view";

import { suggestionField } from "../codemirror/suggestionField";

/** Where to float UI under a document range, in px relative to the editor wrapper. */
export interface Anchor {
  from: number;
  to: number;
  top: number;
  left: number;
}

export interface EditorAnchors {
  /** The user's text selection, only while no suggestion is open. */
  selection: Anchor | null;
  /** The open suggestion's range. */
  suggestion: Anchor | null;
}

function anchorFor(view: EditorView, from: number, to: number, wrapper: DOMRect): Anchor | null {
  const start = view.coordsAtPos(from, 1);
  const end = view.coordsAtPos(to, -1);
  // Null when the range is scrolled out of CodeMirror's rendered viewport.
  if (!start || !end) return null;
  const sameLine = Math.abs(start.top - end.top) < 2;
  const left = sameLine ? start.left : view.contentDOM.getBoundingClientRect().left;
  return { from, to, top: end.bottom - wrapper.top + 6, left: left - wrapper.left };
}

/**
 * Tracks the screen positions of the selection and the open suggestion so the
 * popup and the suggestion card can float right under the text.
 */
export function useEditorAnchors(wrapperRef: RefObject<HTMLElement | null>) {
  const [anchors, setAnchors] = useState<EditorAnchors>({ selection: null, suggestion: null });

  const onUpdate = useCallback(
    (update: ViewUpdate) => {
      // Layout must be read in CodeMirror's measure phase, not during the update.
      update.view.requestMeasure({
        key: "editor-anchors",
        read: (view): EditorAnchors | null => {
          const wrapper = wrapperRef.current;
          if (!wrapper) return null;
          const rect = wrapper.getBoundingClientRect();
          const main = view.state.selection.main;
          const suggestion = view.state.field(suggestionField);
          // Whitespace-only selections (e.g. an empty line) have nothing to rewrite.
          const hasText = view.state.sliceDoc(main.from, main.to).trim() !== "";
          return {
            selection: !suggestion && hasText ? anchorFor(view, main.from, main.to, rect) : null,
            suggestion: suggestion ? anchorFor(view, suggestion.from, suggestion.to, rect) : null,
          };
        },
        write: (next) => {
          if (next) setAnchors(next);
        },
      });
    },
    [wrapperRef],
  );

  return { anchors, onUpdate };
}
