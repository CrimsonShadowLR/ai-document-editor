import { useState, type FormEvent } from "react";

import { Button } from "../../../shared/ui/Button";
import type { SuggestionRange } from "../codemirror/suggestionField";
import { changesOf } from "../diff/diffSegments";
import type { Anchor } from "../hooks/useEditorAnchors";
import { MAX_REFINE_TURNS, type SuggestionState } from "../hooks/useSuggestion";

interface SuggestionCardProps {
  anchor: Anchor;
  state: Exclude<SuggestionState, { status: "idle" }>;
  range: SuggestionRange | null;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onClose: () => void;
  onRetry: () => void;
  onRefine: (instruction: string) => void;
}

export function SuggestionCard({
  anchor,
  state,
  range,
  onAcceptAll,
  onRejectAll,
  onClose,
  onRetry,
  onRefine,
}: SuggestionCardProps) {
  const trail = [...state.request.previousLabels, state.request.action.label];
  return (
    <div
      className="absolute z-10 w-96 max-w-[calc(100%-1rem)] rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-lg"
      style={{ top: anchor.top, left: Math.max(0, anchor.left) }}
    >
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-brand" title={trail.join(" → ")}>
        {trail.join(" → ")}
      </p>

      {state.status === "loading" && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-600">Rewriting…</span>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      )}

      {state.status === "error" && (
        <>
          <p className="mb-3 text-red-700">{state.error}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Dismiss
            </Button>
            <Button onClick={onRetry}>Try again</Button>
          </div>
        </>
      )}

      {state.status === "ready" && (
        <>
          <ReadyContent
            reason={state.result.reason}
            range={range}
            onAcceptAll={onAcceptAll}
            onRejectAll={onRejectAll}
            onClose={onClose}
          />
          {state.request.turns.length < MAX_REFINE_TURNS && <RefineForm onRefine={onRefine} />}
        </>
      )}
    </div>
  );
}

interface ReadyContentProps {
  reason: string | null;
  range: SuggestionRange | null;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onClose: () => void;
}

function ReadyContent({ reason, range, onAcceptAll, onRejectAll, onClose }: ReadyContentProps) {
  const changes = changesOf(range?.segments ?? []);
  const pending = changes.filter((change) => change.status === "pending").length;
  const decided = changes.length - pending;

  if (changes.length === 0) {
    return (
      <>
        <p className="mb-3 text-slate-600">{reason ?? "The AI suggests no changes here."}</p>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      {reason && <p className="mb-2 text-slate-700">{reason}</p>}
      <p className="mb-3 text-xs text-slate-500">
        {pending} of {changes.length} {changes.length === 1 ? "change" : "changes"} to review. Use ✓ / ✕ in
        the text, or decide all at once (Ctrl+Enter / Esc).
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onRejectAll}>
          {decided > 0 ? "Reject rest" : "Reject all"}
        </Button>
        <Button onClick={onAcceptAll}>{decided > 0 ? "Accept rest" : "Accept all"}</Button>
      </div>
    </>
  );
}

function RefineForm({ onRefine }: { onRefine: (instruction: string) => void }) {
  const [instruction, setInstruction] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (instruction.trim()) onRefine(instruction.trim());
  };

  return (
    <form onSubmit={submit} className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
      <input
        className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm placeholder:text-slate-400 focus:border-brand focus:outline-none"
        placeholder="Refine: “shorter”, “more formal”…"
        aria-label="Refine this suggestion"
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
      />
      <Button type="submit" variant="secondary" disabled={!instruction.trim()}>
        Refine
      </Button>
    </form>
  );
}
