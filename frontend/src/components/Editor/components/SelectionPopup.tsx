import { useState, type FormEvent } from "react";

import type { Anchor } from "../hooks/useEditorAnchors";
import { QUICK_ACTIONS, type QuickAction } from "../quickActions";

interface SelectionPopupProps {
  anchor: Anchor;
  disabledReason: string | null;
  onAction: (action: QuickAction) => void;
  onDismiss: () => void;
}

export function SelectionPopup({ anchor, disabledReason, onAction, onDismiss }: SelectionPopupProps) {
  const [custom, setCustom] = useState("");

  const submitCustom = (event: FormEvent) => {
    event.preventDefault();
    const instruction = custom.trim();
    if (instruction) onAction({ label: instruction, instruction });
  };

  return (
    <div
      className="absolute z-10 flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
      style={{ top: anchor.top, left: anchor.left }}
      // Keep the editor's selection while clicking buttons.
      onMouseDown={(event) => {
        if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onDismiss();
      }}
    >
      {disabledReason ? (
        <span className="px-2 py-1 text-sm text-amber-700">{disabledReason}</span>
      ) : (
        <>
          <span className="px-1.5 text-xs font-medium text-brand">AI</span>
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              className="rounded-md px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-100"
              onClick={() => onAction(action)}
            >
              {action.label}
            </button>
          ))}
          <form onSubmit={submitCustom}>
            <input
              className="w-56 rounded-md border border-slate-200 px-2 py-1 text-sm placeholder:text-slate-400 focus:border-brand focus:outline-none"
              placeholder="Or tell the AI what to do…"
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
            />
          </form>
        </>
      )}
    </div>
  );
}
