interface SaveStatusProps {
  isSaved: boolean;
  saveFailed: boolean;
}

/** Autosave status. Plain text with an icon, so it doesn't read as a button. */
export function SaveStatus({ isSaved, saveFailed }: SaveStatusProps) {
  if (saveFailed) {
    return (
      <span
        role="status"
        className="flex items-center gap-1 text-xs text-red-600"
        title="Browser storage is full or blocked (e.g. private mode). Your text only lives in this tab."
      >
        <span aria-hidden="true">⚠</span>
        Not saved
      </span>
    );
  }

  return (
    <span
      role="status"
      className="flex items-center gap-1 text-xs text-slate-400"
      title="Autosaved in this browser. It stays after a reload, but isn't shared with other browsers or devices."
    >
      {isSaved ? (
        <>
          <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3.5 w-3.5 text-emerald-500" fill="none">
            <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Saved in this browser
        </>
      ) : (
        "Saving…"
      )}
    </span>
  );
}
