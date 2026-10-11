---
name: backend-structure
description: Reference for the FastAPI backend in `backend/`. Use whenever adding or modifying endpoints, use cases, config, or backend tests. Covers the layered architecture (router → handler), base classes, naming, package exports, and testing. There is no database.
---
# Backend structure

The backend is a thin API in front of the AI provider. It keeps the API key on the server. There is no database: documents live in the browser.

## Layout

```
backend/
├── pyproject.toml / uv.lock
└── src/
    ├── main.py             # imports `app` from bootstrap, includes routers
    ├── bootstrap.py        # FastAPI app, CORS, request-id logging (+ opaque 500), 422 handler, security headers, /healthcheck
    ├── config.py           # ConfigurationVariables (pydantic-settings, reads the repo-root .env)
    ├── observability.py    # structlog + stdlib logging wiring
    ├── llm/                # LlmClient (openai SDK, OpenAI-compatible) → Completion(content, TokenUsage) + provider errors; get_llm_client dependency (cached)
    ├── usage/              # UsageTracker: in-memory tokens/cost per feature and model; get_usage_tracker dependency
    ├── use_cases/
    │   ├── shared/                 # BaseHandler, BaseDataTransfer
    │   └── <domain>/
    │       ├── __init__.py         # re-exports handlers, requests, responses, errors
    │       ├── errors.py           # domain exceptions
    │       ├── <x>_response.py     # response DTOs (e.g. suggestion_response.py)
    │       └── <action>/           # <action>_handler.py, <action>_request.py, __init__.py,
    │                               # plus private helpers (e.g. prompt.py: prompt + answer parsing)
    ├── routers/<domain>_router.py
    └── test/                       # conftest.py (http_client fixture)
```

## Rules per layer

**Handler**: one class per use case.
```python
class CreateSuggestionHandler(BaseHandler[CreateSuggestionRequest, SuggestionResponse]):
    async def execute(self, request: CreateSuggestionRequest) -> SuggestionResponse:
        ...
```
Raise domain errors from `errors.py`, never `HTTPException`. Logging of start, completion and failure is automatic. Add an `__init__` only for dependencies FastAPI can inject.

**DTOs**: extend `BaseDataTransfer` (snake_case in Python, camelCase on the wire). Validate input with `Field(...)` constraints and `field_validator`.

**Router**:
```python
router = APIRouter(prefix="/suggestions", tags=["suggestions"])

@router.post("", response_model=SuggestionResponse)
async def create_suggestion(request: CreateSuggestionRequest, handler: CreateSuggestionHandler = Depends()):
    try:
        return await handler.execute(request)
    except LlmUnavailableError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
```
Then `app.include_router(...)` in `main.py`.

**When to add a use case**: whenever the endpoint has logic, dependencies or domain errors. An endpoint that only returns config or in-memory totals (`GET /models`, `GET /usage`) can skip the handler and keep its small response DTO in the router.

**Tests**: `async def test_x(http_client)` hits real endpoints. Override `get_llm_client` with a fake (see `test_suggestions_router.py`), or pass `http_client=httpx.AsyncClient(transport=httpx.MockTransport(...))` and `max_retries=0` to `LlmClient` (see `test_llm_client.py`). Tests must never call the real API. Run with `make test`.

## Adding config

1. Add the field to `ConfigurationVariables` with `Field(alias="MY_VAR", default=...)`.
2. Add `MY_VAR` to `.env.example`. Secrets go only in `.env`, which is gitignored.

## Adding a dependency

`cd backend && uv add <pkg>` (dev-only: `uv add --dev <pkg>`).
