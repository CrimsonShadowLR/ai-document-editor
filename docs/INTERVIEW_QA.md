# Interview Q&A

Questions a new developer asked after studying the project, with answers checked against the code. Use it to prepare for questions about how the editor works and why it was built this way.

## How a suggestion flows

1. **Select text.** `useEditorAnchors` measures the selection in CodeMirror's measure phase. If the selection has real text and no suggestion is open, `SelectionPopup` shows.
2. **Ask.** `useSuggestion.request` trims whitespace from the range, opens it in the `suggestionField` (pulsing, locked), and sends `before / selection / after` + instruction + model to `POST /suggestions`.
3. **Backend.** `suggestions_router` → `CreateSuggestionHandler` → `LlmClient` (official `openai` SDK against OpenRouter's OpenAI-compatible API). `prompt.py` builds the messages and parses the `<replacement>` / `<reason>` tags.
4. **Diff.** `diffSegments` (jsdiff `diffWordsWithSpace`) splits the original into unchanged parts and reviewable changes. They are drawn as CodeMirror decorations: red strikethrough, green insertions, ✓ / ✕.
5. **Decide.** When no change is pending, `resolveChanges` writes the result in one transaction (`userEvent: "input.ai"`), so one Ctrl+Z undoes it.
6. **History.** `useSuggestion.syncFromEditor` sees that transaction and records a snapshot in `useHistory` (localStorage).

## Endpoints

| Endpoint | Request → Response | Errors |
|---|---|---|
| `GET /healthcheck` | → `{status: "healthy"}` | — |
| `GET /models` | → `{models: string[], default: string \| null}` from `LLM_MODELS` | — |
| `POST /suggestions` | `{before, selection, after, instruction, model?, turns[], feature}` → `{replacement, reason, model}` | 422 validation, 400 unknown model, 503 no key / no models, 429 rate limited, 502 provider failed or answer without tags, 500 opaque |
| `GET /usage` | → requests, prompt/completion/reasoning tokens and cost (USD) in total, per feature and per model | — |

`feature` (`improve`, `shorter`, `formal`, `custom`, `refine`) only labels usage. Every response has an `X-Request-ID` header. Limits: `selection` ≤ 20,000 characters, `before` / `after` ≤ 100,000 each, `instruction` ≤ 1,000, at most 10 `turns`. The frontend applies the same limits before sending (`Editor/limits.ts`).

## Architecture

**1. Why does the open suggestion live in a CodeMirror `StateField`, and also in React state?**
The field must be CodeMirror state for three reasons. Its range is remapped in the same transaction as every edit. Decorations are computed from it. And the change filter (the lock) reads it synchronously. React keeps a copy (`useSuggestion`'s `range`) only so the card re-renders, for example to update "2 of 3 changes". If the range lived only in React, it would be stale between keystrokes, and the lock and decorations couldn't see it.

**2. The ✓ / ✕ buttons call `resolveChanges` directly from the DOM. Is that deliberate?**
Yes. CodeMirror owns the range and the per-change decisions, and React observes them through `onUpdate` → `syncFromEditor`. A decision and the document write that may follow happen in the same dispatch, so they can't get out of sync.

**3. Why parse the tags on the server, not in the browser?**
The browser gets a stable, typed `{replacement, reason, model}`, whatever the model does. A malformed answer becomes one clear 502. The format can change later (for example to JSON mode) without touching the frontend, and the parser is tested in pytest (`test_prompt.py`).

## Backend and endpoints

**4. `GET /models` has no handler class. When is a use case needed?**
When an endpoint has logic, dependencies or domain errors. `/models` only reads config, so a router function is enough. This rule is now in the backend skill.

**5. Why is a provider 401/403 a 502, but a missing key a 503?**
A missing key means our server isn't configured: 503, and the operator must fix it. A provider rejecting the key is an upstream failure: 502, bad gateway. Returning 401 to the browser would wrongly suggest that the *user* must log in.

**6. How is the HTTP connection to the provider managed?**
`get_llm_client` is cached, so there is one `AsyncOpenAI` client per process and its connections are pooled. The first version used plain `httpx` with a new client per call; the switch to the official SDK also brought typed errors and one automatic retry (with backoff) on 429/5xx. Tests inject an `httpx.AsyncClient` with a `MockTransport` through the SDK's `http_client`.

**7. The handler reads config directly, but `LlmClient` is injected. Why?**
It's an inconsistency inherited from the template. Config is a cached singleton, so tests monkeypatch it. Injecting it with `Depends(get_configuration_variables)` would be cleaner.

**8. On an unhandled exception, does the 500 keep the request ID and security headers?**
Now it does. Before the review it didn't: the global exception handler ran outside the user middlewares, so the 500 had no `X-Request-ID` and no security headers, and the error was logged up to three times. Now `log_requests` catches the exception, logs it once with a stack trace and returns the opaque 500 itself (`bootstrap.py`). A test covers it.

**9. Why was `allow_credentials=True`?**
A template leftover. There are no cookies or auth, so it's now `False`.

## AI integration and prompt

**10. Which `<replacement>` block is used if the model writes more than one?**
The last one. A reasoning model may draft the format (for example inside `<think>`) before its final answer. A stray opening tag can't swallow a later block either. Both cases are tested.

**11. What if the document contains the text `<selection>`?**
A known limitation. The model could misread where the selection starts or ends. Parsing isn't affected, only the prompt. The fix would be escaping or unique delimiters, tested with prompt evaluations first.

**12. Do small models drop the tags on refine turns?**
It can't be verified without real calls. The system prompt with the format is sent on every turn, but the follow-up message doesn't restate it. If a model drops the tags, the user sees "did not answer in the expected format" with Try again.

**13. Why temperature 0.4 and no `max_tokens`? How is cost controlled?**
Untuned defaults: some variety for rewrites. Cost is bounded by input limits only: up to 100,000 characters of context on each side, 20,000 for the selection, at most 10 turns, all resent on each refine. Making these configurable is a possible improvement.

**14. Do "model busy" errors come as 429, or as 502/503?**
Both. OpenRouter sends 429 for rate limits (including "rate-limited upstream" on `:free` models) and 502/503 when no provider is available. Both messages now say "Try again or pick another model."

## Frontend state and CodeMirror

**15. What happens when Ctrl+Z touches an open suggestion's text?**
Undo/redo skip change filters, so the lock doesn't stop them. Before the review, an undo over the open range inverted it and crashed the decorations. Now the field closes the suggestion if an unfiltered change rewrites its text. This is covered by a Vitest test.

**16. Does typing exactly at the edge of the locked range count as inside?**
No. Insertions at `from` or `to` pass the filter, and `mapPos(from, 1)` / `mapPos(to, -1)` keep them outside the range. Tested.

**17. Does Cancel stop the request?**
Yes. Cancel, close, a newer request and unmount all abort the axios request with an `AbortController`. The limit: the backend's call to the provider still finishes, so quota is still spent.

**18. Can a refine switch models in the middle of a suggestion?**
Not anymore. The model picker is disabled while a suggestion is open.

**19. What do Ctrl+Enter and Esc do inside the Refine box?**
Enter and Esc typed in a text box are left to that box, so Esc there no longer throws the suggestion away. Outside text boxes: Ctrl+Enter accepts all, Esc rejects (or cancels, or hides the popup), and Ctrl+K focuses the instruction box.

## Diff logic

**20. How does merging work for list rewrites?**
Changes separated by at most two unchanged words *on the same line* are merged. A gap with a line break never merges, so a list rewrite gives one change per line. That is the intended granularity.

**21. Change IDs aren't contiguous after merging. Does that matter?**
No. IDs are only compared for equality, never used as indexes.

**22. What if the model returns Windows line endings (`\r\n`)?**
That was a bug: CodeMirror stores `\r\n` as one character, but the cursor position used the string length. `parse_completion` now converts all line endings to `\n`. Tested.

## History and persistence

**23. Can a restore lose my own edits?**
No. Before restoring, edits that no history entry holds are saved as "Your edits before restoring". The timeline keeps the newest 100 entries; when older ones drop off, the panel says how many were removed. (It used to be 30, which filled up quickly when going back and forth: every restore adds two entries.)

**24. Does History react to Ctrl+Z?**
No, a known limitation. Only the "current" badge follows, because it compares document text. What an undone AI edit should mean in the timeline is a product decision.

**25. What if the stored history is corrupt?**
Broken JSON falls back to an empty history (try/catch). Valid JSON of the wrong shape isn't validated yet.

**26. What if the browser can't save?**
The toolbar shows "Not saved" when localStorage is full or blocked (for example in private mode), and "Saved" again once a write works.

## Clean code and conventions

**27. The `hooks/` folder holds more than React Query hooks. Is that allowed?**
Yes. The skill now says `hooks/` holds one React Query hook per endpoint plus the feature's other hooks.

**28. Why does the CSS use `color-mix` instead of fixed colors?**
The skill says to use tokens, not hex. The CodeMirror tints now derive from `var(--color-brand)` with `color-mix`, which gives the same colors.

## Testing

**29. What is tested on the frontend?**
Vitest (`npm test`, 23 tests). The diff logic: exact rebuild of both texts, merge rules, partial accepts. The CodeMirror suggestion state: range mapping, edge typing, the lock, closing on undo, decisions. These run on a bare `EditorState`, with no browser. The full UI flow was tested by hand with Playwright.

**30. What is tested on the backend?**
pytest (57 tests), with the AI provider always mocked. It covers the endpoints and their error codes, multi-turn messages, the 10-turn cap, blank instructions, tag parsing (last block, stray tags, CRLF), provider error messages, `X-Request-ID`, security headers and the 500 path.

## Trade-offs

**31. Why tags instead of JSON mode or tool calling? Why no streaming?**
Free models don't reliably support JSON mode or tools, and escaping Markdown inside JSON breaks easily. Supporting both tags and JSON would double the parsing paths. Streaming would make the diff jump on every token; a paragraph rewrite takes about 2 s, so a loading state works fine.

**32. Why `diffWordsWithSpace`, not `diffWords` or a character diff?**
It keeps whitespace and line breaks as tokens, so the unchanged and removed parts rebuild the original exactly. That matters because the original stays in the document during review. `diffWords` ignores whitespace changes, and a character diff is too noisy for rewrites.

## Token and cost tracking

**33. How do you know how many tokens and how much money each feature uses?**
The frontend sends which action started a call (`feature`: improve, shorter, formal, custom, refine). `LlmClient` reads `usage` from the response: prompt, completion and reasoning tokens, and OpenRouter's `cost` in USD. The handler records it in an in-memory `UsageTracker` before parsing the answer, because the tokens are spent even if the answer is malformed. `GET /usage` shows totals and averages per feature and per model, and every `llm.completed` log line carries the same numbers plus the feature. Failed calls aren't counted. Totals reset when the server restarts; OpenRouter's Activity page keeps the full history.
