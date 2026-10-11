import { useCallback, useRef, useState } from "react";
import type { EditorView, ViewUpdate } from "@codemirror/view";

import { MarkdownEditor } from "./components/MarkdownEditor";
import { ModelPicker } from "./components/ModelPicker";
import { SelectionPopup } from "./components/SelectionPopup";
import { SuggestionCard } from "./components/SuggestionCard";
import { useDocument } from "./hooks/useDocument";
import { useEditorAnchors } from "./hooks/useEditorAnchors";
import { useSelectedModel } from "./hooks/useSelectedModel";
import { useSuggestion } from "./hooks/useSuggestion";

export function Editor() {
  const { content, setContent, isSaved } = useDocument();
  const modelSelection = useSelectedModel();
  const [view, setView] = useState<EditorView | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { anchors, onUpdate: updateAnchors } = useEditorAnchors(wrapperRef);
  const suggestion = useSuggestion(view, modelSelection.selected);
  const { syncFromEditor } = suggestion;
  const onUpdate = useCallback(
    (update: ViewUpdate) => {
      updateAnchors(update);
      syncFromEditor(update);
    },
    [updateAnchors, syncFromEditor],
  );
  // Esc hides the popup for this exact selection until it changes.
  const [dismissedSelection, setDismissedSelection] = useState<string | null>(null);

  const selection = anchors.selection;
  const selectionKey = selection ? `${selection.from}:${selection.to}` : null;
  const showPopup = selection && suggestion.state.status === "idle" && selectionKey !== dismissedSelection;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <ModelPicker {...modelSelection} />
        <span className="text-xs text-slate-400">{isSaved ? "Saved" : "Saving…"}</span>
      </div>
      <div ref={wrapperRef} className="relative">
        <MarkdownEditor value={content} onChange={setContent} onCreateEditor={setView} onUpdate={onUpdate} />
        {showPopup && (
          <SelectionPopup
            key={selectionKey}
            anchor={selection}
            disabledReason={modelSelection.selected ? null : "No AI model available"}
            onAction={suggestion.request}
            onDismiss={() => {
              setDismissedSelection(selectionKey);
              view?.focus();
            }}
          />
        )}
        {suggestion.state.status !== "idle" && anchors.suggestion && (
          <SuggestionCard
            anchor={anchors.suggestion}
            state={suggestion.state}
            range={suggestion.range}
            onAcceptAll={suggestion.acceptAll}
            onRejectAll={suggestion.rejectAll}
            onClose={suggestion.close}
            onRetry={suggestion.retry}
          />
        )}
      </div>
    </div>
  );
}
