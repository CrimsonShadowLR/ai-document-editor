# Build plan

## Idea

The user writes Markdown. They select text and ask the AI for help (Improve, Shorter, Formal, or a custom instruction). The AI rewrites **only the selection** and sees the whole document as context. It acts as a co-author; it doesn't write the whole document. The change shows as inline tracked changes, and the user accepts or rejects each part.

## Decisions

| Topic | Choice | Why |
|---|---|---|
| Infrastructure | No AWS, no Docker, no database | The brief asks for no extra infrastructure |
| Backend | FastAPI as a thin AI proxy | Keeps the API key off the browser |
| Storage | Browser localStorage | Enough for one user, no server state |
| Editor | CodeMirror 6 via `@uiw/react-codemirror` | Raw Markdown text maps cleanly to text diffs |
| Diff | jsdiff (`diff`), word-level | Small and well known; we draw the highlights |
| Suggestions | Inline tracked changes, one open at a time | Clear and simple; no overlapping ranges |
| Accept/reject | Per change, plus Accept all / Reject all | The user stays in control |
| Refine | Follow-up box that keeps earlier turns | Multi-turn: "shorter", then "more formal" |
| History | Timeline of snapshots after each accepted edit | Shows how the document evolved with AI help |
| Streaming | No | The diff would jump on every token; a paragraph rewrite is fast anyway |
| LLM client | Plain `httpx`, OpenAI-compatible `/chat/completions` | One API call; LangChain/LangSmith would be over-engineering |
| Provider | Generic `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODELS` | OpenRouter ':free' models for dev, the $5 OpenRouter key for production; switch via `.env` only |
| Model choice | Picker in the UI, fixed list from config | The user sees the trade-off between models |
| AI output | Tagged text: `<replacement>…</replacement><reason>…</reason>` | Works on any model, including small free ones; no JSON escaping of Markdown |

## API

| Endpoint | Input → Output |
|---|---|
| `GET /models` | → `{models: string[], default: string}` from `LLM_MODELS` |
| `POST /suggestions` | `{before, selection, after, instruction, model?, turns[]}` → `{replacement, reason, model}` |

`turns[]` holds earlier refine steps (instruction + replacement), so a follow-up builds on the last result.

The document is sent split around the selection (`before` / `selection` / `after`) instead of text + offsets, because JavaScript and Python count characters differently (emoji).

Errors: no key or no models → 503 with a clear message; unknown model → 400; provider rate limit → 429; provider failure or answer without tags → 502.

## Steps (one commit each)

1. **Backend AI endpoint**: config, `LlmClient` (httpx), `/models`, `/suggestions`, prompt, tag parsing. Tests mock the provider and never call a real API.
2. **Editor**: CodeMirror with Markdown, an example document on first load, autosave to localStorage, model picker in the header.
3. **Selection popup**: quick actions + custom instruction; "Rewriting…" state on the selection while loading.
4. **Inline diff**: red strikethrough for deletions, green for insertions; accept/reject per change, Accept all / Reject all. The range is locked while the suggestion is open so positions can't drift.
5. **Refine**: follow-up box on the suggestion card; the diff updates in place.
6. **History**: snapshot after each accepted edit; side timeline with view and restore.
7. **Polish and docs**: error states, shortcuts (Ctrl+Enter accept, Esc reject), README sections, AI transcripts in `ai-sessions/`.

## Status

All seven steps are done. Changes made along the way:

- Dev provider: OpenRouter `:free` models instead of Groq. Nemotron is the default because Gemma's free endpoint is often busy upstream.
- Diff: changes split by 1–2 unchanged words on the same line are merged, so a rewrite isn't nine tiny changes.
- Shortcuts: Ctrl/⌘+K focuses the popup's instruction box (on top of Ctrl/⌘+Enter and Esc).

## Left out on purpose

- Streaming, real-time multi-user editing, auth, server storage, LangChain/LangSmith, several open suggestions at once.
