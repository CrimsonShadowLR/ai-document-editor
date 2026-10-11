import { Button } from "../../../shared/ui/Button";
import type { Anchor } from "../hooks/useEditorAnchors";
import type { SuggestionState } from "../hooks/useSuggestion";

interface SuggestionCardProps {
  anchor: Anchor;
  state: Exclude<SuggestionState, { status: "idle" }>;
  onAccept: () => void;
  onReject: () => void;
  onRetry: () => void;
}

export function SuggestionCard({ anchor, state, onAccept, onReject, onRetry }: SuggestionCardProps) {
  return (
    <div
      className="absolute z-10 w-96 max-w-[calc(100%-1rem)] rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg"
      style={{ top: anchor.top, left: Math.max(0, anchor.left) }}
    >
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-brand">
        {state.request.action.label}
      </p>

      {state.status === "loading" && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-600">Rewriting…</span>
          <Button variant="secondary" onClick={onReject}>
            Cancel
          </Button>
        </div>
      )}

      {state.status === "error" && (
        <>
          <p className="mb-3 text-red-700">{state.error}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onReject}>
              Dismiss
            </Button>
            <Button onClick={onRetry}>Try again</Button>
          </div>
        </>
      )}

      {state.status === "ready" && (
        <>
          {state.result.reason && <p className="mb-2 text-slate-600">{state.result.reason}</p>}
          <p className="mb-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-emerald-50 p-2 text-slate-800">
            {state.result.replacement}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onReject}>
              Reject
            </Button>
            <Button onClick={onAccept}>Accept</Button>
          </div>
        </>
      )}
    </div>
  );
}
