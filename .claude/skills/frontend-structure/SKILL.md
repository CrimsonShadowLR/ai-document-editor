---
name: frontend-structure
description: Reference for the React + Vite + TypeScript frontend in `frontend/`. Use whenever adding or modifying pages, components, API calls, React Query hooks, CodeMirror extensions, routes, or Tailwind styles. Covers the feature-folder layout, the shared HTTP client, query-key conventions, and the editor's CodeMirror state.
---
# Frontend structure

## Layout

```
frontend/src/
├── main.tsx                 # QueryClientProvider + <App />
├── App.tsx                  # routes (react-router-dom), all under <AppLayout />
├── index.css                # Tailwind v4 + @theme tokens (brand colors) + CodeMirror diff classes
├── vite-env.d.ts            # typed import.meta.env (add VITE_* vars here)
├── shared/
│   ├── httpClient.ts        # axios instance: get/post (abortable), errorMessage()
│   ├── storage.ts           # readStorage/writeStorage: localStorage that never throws
│   ├── useDebouncedValue.ts
│   └── ui/                  # Button (shared, dumb, styled)
└── components/
    ├── layout/AppLayout.tsx # header + <Outlet />
    └── <Feature>/           # PascalCase, one folder per feature
        ├── index.tsx        # page component (named export)
        ├── api/             # one file per endpoint: listX.ts, createX.ts, ...
        ├── hooks/           # React Query hooks, one per endpoint (useX.ts, useCreateX.ts),
        │                    # plus the feature's other hooks (state, persistence, editor wiring)
        ├── components/      # feature-private components
        ├── schema/          # wire and stored types (interface)
        └── *.ts             # small feature helpers (quickActions.ts, formatTime.ts, ...)
```

The `Editor` feature also has `codemirror/` (the suggestion `StateField`, its decorations and range lock) and `diff/` (`diffSegments.ts`: jsdiff output → reviewable changes).

## Data flow

```
component → hook (React Query) → api function → shared/httpClient → backend
```
Components never import axios or `httpClient` for fetching. Only api functions do.

## Conventions

- **API function**: typed, thin. `export async function suggestEdit(body: SuggestEditBody): Promise<Suggestion> { return post<Suggestion>("/suggestions", body); }`
- **Query hook**: export a key prefix `export const ORDERS_QUERY_KEY = ["orders"] as const;` and use `queryKey: [...ORDERS_QUERY_KEY, params]`. Use `placeholderData: keepPreviousData` for paginated lists.
- **Mutation hook**: `useMutation({ mutationFn, onSuccess: () => queryClient.invalidateQueries({ queryKey: X_QUERY_KEY }) })`.
- **Errors**: show `errorMessage(mutation.error)`. It extracts FastAPI's `detail`, both string and 422 list.
- **Editor state**: anything that must follow document edits (the open suggestion's range, its diff, per-change decisions) lives in a CodeMirror `StateField` (`Editor/codemirror/`), not in React state. React mirrors it via the editor's `onUpdate`. Write to the document with `view.dispatch` so edits stay undoable.
- **Wire format** is camelCase (the backend aliases snake_case automatically).
- **Styling**: Tailwind utility classes only. Use the brand token (`bg-brand`, `text-brand`, `hover:bg-brand-hover`, `ring-brand/40`), never hex. CodeMirror classes in `index.css` can't use utilities; derive brand tints from `var(--color-brand)` (`color-mix`).
- **TypeScript**: `verbatimModuleSyntax` is on, so type-only imports need `import type` / `type`.
- **Storage**: documents and version history live in browser `localStorage`. There is no database.
- New page: add a `<Route>` in `App.tsx`.

## Commands

`make frontend` (or `npm run dev` in `frontend/`), `npm run build` (type-check + bundle), `npm run lint`. Add deps with `npm install <pkg>` in `frontend/`. `VITE_*` vars come from the root `.env` (`envDir: '..'`).
