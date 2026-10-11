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
- Backend: FastAPI, used as a thin AI proxy. The OpenRouter key stays on the server, in `.env`.
- Storage: browser `localStorage` (documents and version history).
- Run: plain `uv` + `npm` through the Makefile (`make install`, `make backend`, `make frontend`).
- Still to decide: editor library, diff library, AI model.

## Architecture
- Backend: see the `backend-structure` skill (router → handler, no DB).
- Frontend: see the `frontend-structure` skill (feature folders, React Query).
- Secrets go only in `.env`, never in code, chat or commits. AI session transcripts go in `ai-sessions/`.
