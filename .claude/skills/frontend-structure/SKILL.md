---
name: frontend-structure
description: Reference for the React + Vite + TypeScript frontend in `frontend/`. Use whenever adding or modifying pages, components, API calls, React Query hooks, forms, routes, or Tailwind styles. Covers the feature-folder layout, the shared HTTP client, query-key conventions, and form validation with zod.
---
# Frontend structure

## Layout

```
frontend/src/
├── main.tsx                 # QueryClientProvider + <App />
├── App.tsx                  # routes (react-router-dom), all under <AppLayout />
├── index.css                # Tailwind v4 + @theme tokens (brand colors)
├── vite-env.d.ts            # typed import.meta.env (add VITE_* vars here)
├── shared/
│   ├── httpClient.ts        # axios instance: get/post/patch/del, errorMessage()
│   ├── useDebouncedValue.ts
│   └── ui/                  # Button, TextField, ... (shared, dumb, styled)
└── components/
    ├── layout/AppLayout.tsx # header + <Outlet />
    └── <Feature>/           # PascalCase, one folder per feature
        ├── index.tsx        # page component (named export)
        ├── api/             # one file per endpoint: listX.ts, createX.ts, ...
        ├── hooks/           # one React Query hook per endpoint: useX.ts, useCreateX.ts
        ├── components/      # feature-private components
        └── schema/          # wire types (interface) + zod form schemas
```

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
- **Forms**: define the zod schema in `schema/`. `safeParse` on submit, map `issues` to per-field errors, send `parsed.data`. Keep the constraints in line with the backend request DTO.
- **Wire format** is camelCase (the backend aliases snake_case automatically).
- **Styling**: Tailwind utility classes only. Use the brand token (`bg-brand`, `text-brand`, `hover:bg-brand-hover`, `ring-brand/40`), never hex.
- **TypeScript**: `verbatimModuleSyntax` is on, so type-only imports need `import type` / `type`.
- **Storage**: documents and version history live in browser `localStorage`. There is no database.
- New page: add a `<Route>` in `App.tsx`.

## Commands

`make frontend` (or `npm run dev` in `frontend/`), `npm run build` (type-check + bundle), `npm run lint`. Add deps with `npm install <pkg>` in `frontend/`. `VITE_*` vars come from the root `.env` (`envDir: '..'`).
