import { useCallback, useRef, useState } from "react";
import type { EditorView, ViewUpdate } from "@codemirror/view";

import { HistoryPanel } from "./components/HistoryPanel";
import { MarkdownEditor } from "./components/MarkdownEditor";
import { ModelPicker } from "./components/ModelPicker";
import { SelectionPopup } from "./components/SelectionPopup";
import { SuggestionCard } from "./components/SuggestionCard";
import { useDocument } from "./hooks/useDocument";
import { useEditorAnchors } from "./hooks/useEditorAnchors";
import { useHistory } from "./hooks/useHistory";
import { useSelectedModel } from "./hooks/useSelectedModel";
import { useSuggestion, type AppliedEdit } from "./hooks/useSuggestion";
import type { HistoryEntry } from "./schema/history";
import { formatTime } from "./formatTime";

export function Editor() {
  const { content, setContent, isSaved } = useDocument();
  const modelSelection = useSelectedModel();
  const [view, setView] = useState<EditorView | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { anchors, onUpdate: updateAnchors } = useEditorAnchors(wrapperRef);
  const history = useHistory();
  const [showHistory, setShowHistory] = useState(true);

  const { record } = history;
  const recordAppliedEdit = useCallback(
    (edit: AppliedEdit) =>
      record(
        {
          kind: "ai-edit",
          label: edit.label,
          model: edit.model,
          document: edit.documentAfter,
          passageBefore: edit.passageBefore,
          passageAfter: edit.passageAfter,
        },
        edit.documentBefore,
      ),
    [record],
  );
  const suggestion = useSuggestion(view, modelSelection.selected, recordAppliedEdit);

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

  /** Replace the whole document with an earlier version, as one undoable step. */
  const restore = (entry: HistoryEntry) => {
    if (!view) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: entry.document },
      userEvent: "input.restore",
    });
    record({ kind: "restore", label: `Restored version from ${formatTime(entry.at)}`, document: entry.document });
    view.focus();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <ModelPicker {...modelSelection} />
        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-400">{isSaved ? "Saved" : "Saving…"}</span>
          <button
            type="button"
            className="text-sm text-slate-600 hover:text-slate-900"
            aria-pressed={showHistory}
            onClick={() => setShowHistory((shown) => !shown)}
          >
            History ({history.entries.length})
          </button>
        </div>
      </div>
      <div className={`grid gap-4 ${showHistory ? "lg:grid-cols-[minmax(0,1fr)_18rem]" : ""}`}>
        <div ref={wrapperRef} className="relative min-w-0">
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
              onRefine={suggestion.refine}
            />
          )}
        </div>
        {showHistory && (
          <HistoryPanel
            entries={history.entries}
            currentDocument={content}
            restoreBlockedReason={
              suggestion.state.status === "idle" ? null : "Finish the open suggestion first"
            }
            onRestore={restore}
            onClear={history.clear}
          />
        )}
      </div>
    </div>
  );
}

