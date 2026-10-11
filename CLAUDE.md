# CLAUDE.md

## Project
Chiri engineering assessment: a collaborative AI document editor for Markdown. The full brief is in `Engineering Assessment 2026.pdf`.

## Rules for working with me

1. **Ask with options.** When you need to ask me something, use the question tool and give me options to pick from. Don't ask open-ended questions.
2. **Don't choose the stack yourself.** Frameworks, libraries, models and architecture are discussed with me first. Present the options, then wait for my decision.
3. **Correct my English.** When my message has grammar or wording mistakes, show the corrected version briefly at the start of your reply.
4. **Keep it direct and simple.** Use short sentences and plain words. No long explanations unless I ask for them.

## Decisions so far
- No AWS, no Docker, no database. The PDF asks for no extra infrastructure.
- Backend: FastAPI, used as a thin AI proxy. The API key stays on the server, in `.env`.
- Storage: browser `localStorage` (documents and version history).
- Run: plain `uv` + `npm` through the Makefile (`make install`, `make backend`, `make frontend`).
- Editor: CodeMirror 6 (raw Markdown text) via `@uiw/react-codemirror`.
- Diff: jsdiff (`diff` package), highlights drawn by us.
- Model: the user picks it in the UI from a fixed list of 2–3 model IDs in backend config (`LLM_MODELS`).
- Provider: generic OpenAI-compatible settings in `.env`: `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODELS`. Switching provider changes only `.env`. Develop and test with Groq's free tier. The $5 OpenRouter key from Chiri is the production key: never use it until everything is set up and the user says so.
- Suggestions: inline tracked changes in the editor (red strikethrough / green insertions), accept or reject each one. One open suggestion at a time.
- Trigger: select text, a small popup appears with quick actions (Improve, Shorter, Formal) and a custom instruction.
- Refine: a follow-up box under the suggestion ('make it shorter'). The AI updates the same suggestion and keeps the earlier turns.
- Accept/reject: per change, plus 'Accept all' / 'Reject all' for the suggestion.
- History: a simple timeline. Each accepted AI edit saves a snapshot to localStorage; the user can view and restore it.
- No streaming: a loading state on the selection, then the full diff. Streaming goes under 'with more time'.
- LLM client: plain `httpx` POST to an OpenAI-compatible `/chat/completions`. No LangChain, no LangSmith (one API call, no agents/RAG; structlog covers logging).
- AI output format: tagged text `<replacement>…</replacement><reason>…</reason>` (works on any model).
- The full build plan is in `docs/PLAN.md`. Keep it updated when a decision changes.
- The assessment PDF stays out of git (`.gitignore`).

## Architecture
- Backend: see the `backend-structure` skill (router → handler, no DB).
- Frontend: see the `frontend-structure` skill (feature folders, React Query).
- Secrets go only in `.env`, never in code, chat or commits. AI session transcripts go in `ai-sessions/`.
