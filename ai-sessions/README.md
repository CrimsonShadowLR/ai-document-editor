# AI sessions

The whole project was built in **one Claude Code session** (model: Claude Opus 5.5).

| File | What it is |
|---|---|
| `claude-code-session.txt` | The full conversation, exported with Claude Code's `/export`: every prompt, answer, decision and tool call (file edits, tests, browser checks). |

## How to read it

The session follows the commit history (`git log --reverse`):

1. **Brief and rules.** Claude read the assessment PDF. I set the rules for working together in `CLAUDE.md`: ask with options, never choose the stack alone, correct my English, keep answers short.
2. **Template cleanup.** We started from my full-stack template and removed what the brief doesn't need: AWS/Terraform, Docker, Postgres and the sample feature.
3. **Decisions.** Every stack and UX choice was a short question with options (editor, diff library, model, storage, streaming, LangChain…), recorded in `CLAUDE.md` and `docs/PLAN.md`.
4. **Seven build steps, one commit each.** Each step was checked with lint, type checks, tests and a real browser (Playwright). The AI was faked in most browser tests to save quota, with a few real calls.
5. **Review with two subagents.** A "new developer" agent studied the project and wrote 32 questions and findings. An "expert" agent answered them and fixed the real issues. I reviewed and browser-tested its changes before committing. The result is `docs/INTERVIEW_QA.md`.
6. **Production.** Token and cost tracking per feature (`GET /usage`), a switch to the official OpenAI SDK, and the production OpenRouter key with paid models (about $0.0001 per edit).
7. **Polish from my own testing.** A clearer autosave label, and a history fix after going back and forth between versions.

## Privacy check

Before committing, the export was scanned for secrets. It contains no API keys or tokens (only placeholders like `sk-or-...your key...`), and the `.env` file was never shown. Local file paths (`C:\Users\...`) are left as they are.
