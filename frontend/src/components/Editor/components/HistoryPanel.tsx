import { useState } from "react";

import { Button } from "../../../shared/ui/Button";
import { diffSegments } from "../diff/diffSegments";
import type { HistoryEntry } from "../schema/history";
import { formatTime } from "../formatTime";

interface HistoryPanelProps {
  entries: HistoryEntry[];
  currentDocument: string;
  /** Why restoring is blocked right now (an open suggestion), or null. */
  restoreBlockedReason: string | null;
  onRestore: (entry: HistoryEntry) => void;
  onClear: () => void;
}

export function HistoryPanel({
  entries,
  currentDocument,
  restoreBlockedReason,
  onRestore,
  onClear,
}: HistoryPanelProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const currentId = entries.find((entry) => entry.document === currentDocument)?.id;

  return (
    <aside className="self-start rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium text-slate-800">History</h2>
        {entries.length > 0 && (
          <button type="button" className="text-xs text-slate-400 hover:text-slate-600" onClick={onClear}>
            Clear
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <p className="text-slate-500">Accepted AI edits show up here, so you can see and restore earlier versions.</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {entries.map((entry) => {
            const isOpen = entry.id === openId;
            return (
              <li key={entry.id} className="rounded-md border border-transparent hover:border-slate-200">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-50"
                  aria-expanded={isOpen}
                  onClick={() => setOpenId(isOpen ? null : entry.id)}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-slate-800" title={entry.label}>
                      {entry.label}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {formatTime(entry.at)}
                      {entry.model && ` · ${entry.model}`}
                    </span>
                  </span>
                  {entry.id === currentId && (
                    <span className="shrink-0 rounded bg-brand/10 px-1.5 py-0.5 text-xs text-brand">current</span>
                  )}
                </button>

                {isOpen && (
                  <div className="px-2 pb-2">
                    {entry.passageBefore !== undefined && entry.passageAfter !== undefined && (
                      <PassageDiff before={entry.passageBefore} after={entry.passageAfter} />
                    )}
                    {entry.id !== currentId && (
                      <Button
                        variant="secondary"
                        className="mt-2 w-full"
                        disabled={restoreBlockedReason !== null}
                        title={restoreBlockedReason ?? undefined}
                        onClick={() => onRestore(entry)}
                      >
                        Restore this version
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}

/** Read-only red/green view of what one AI edit changed. */
function PassageDiff({ before, after }: { before: string; after: string }) {
  return (
    <p className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-2 font-mono text-xs leading-relaxed text-slate-700">
      {diffSegments(before, after).map((segment, index) =>
        segment.kind === "same" ? (
          <span key={index}>{segment.text}</span>
        ) : (
          <span key={index}>
            {segment.oldText && <del className="cm-diff-deleted">{segment.oldText}</del>}
            {segment.newText && <ins className="cm-diff-inserted no-underline">{segment.newText}</ins>}
          </span>
        ),
      )}
    </p>
  );
}
