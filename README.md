# AI Document Editor

A collaborative Markdown editor where an AI co-author suggests edits as diffs. Built for the Chiri engineering assessment.

> Work in progress. The "What I built" and "What I'd do differently" sections will be filled in at the end.

## How to run

Requirements: Python 3.14 with [uv](https://docs.astral.sh/uv/), Node 22+, and `make` (on Windows use Git Bash).

```bash
make install      # creates .env, installs backend + frontend deps
make backend      # terminal 1: API on http://localhost:8000
make frontend     # terminal 2: app on http://localhost:5173
```

Other targets: `make test`, `make lint`, `make build`, `make help`.

## Stack

| Layer    | Tech |
|----------|------|
| Backend  | Python 3.14, FastAPI, uv, structlog, pytest |
| Frontend | React 19, Vite, TypeScript, Tailwind v4, TanStack Query, axios, zod |

## What I built

TODO

## What I'd do differently with more time

TODO

## AI sessions

The transcripts of the AI sessions used to build this are in `ai-sessions/`.
