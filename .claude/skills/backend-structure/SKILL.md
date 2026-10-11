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
    ├── bootstrap.py        # FastAPI app, CORS, request-id logging, error handlers, /healthcheck
    ├── config.py           # ConfigurationVariables (pydantic-settings, reads ../.env)
    ├── observability.py    # structlog + stdlib logging wiring
    ├── use_cases/
    │   ├── shared/                 # BaseHandler, BaseDataTransfer
    │   └── <domain>/
    │       ├── __init__.py         # re-exports handlers, requests, responses, errors
    │       ├── errors.py           # domain exceptions
    │       └── <action>/           # <action>_handler.py, <action>_request.py, __init__.py
    ├── routers/<domain>_router.py
    └── test/                       # conftest.py (http_client fixture)
```

## Rules per layer

**Handler**: one class per use case.
```python
class SuggestEditHandler(BaseHandler[SuggestEditRequest, SuggestEditResponse]):
    async def execute(self, request: SuggestEditRequest) -> SuggestEditResponse:
        ...
```
Raise domain errors from `errors.py`, never `HTTPException`. Logging of start, completion and failure is automatic. Add an `__init__` only for dependencies FastAPI can inject.

**DTOs**: extend `BaseDataTransfer` (snake_case in Python, camelCase on the wire). Validate input with `Field(...)` constraints and `field_validator`.

**Router**:
```python
router = APIRouter(prefix="/suggestions", tags=["suggestions"])

@router.post("", response_model=SuggestEditResponse)
async def suggest_edit(request: SuggestEditRequest, handler: SuggestEditHandler = Depends()):
    try:
        return await handler.execute(request)
    except ProviderUnavailableError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
```
Then `app.include_router(...)` in `main.py`.

**Tests**: `async def test_x(http_client)` hits real endpoints. Mock the AI provider; tests must never call the real API. Run with `make test`.

## Adding config

1. Add the field to `ConfigurationVariables` with `Field(alias="MY_VAR", default=...)`.
2. Add `MY_VAR` to `.env.example`. Secrets go only in `.env`, which is gitignored.

## Adding a dependency

`cd backend && uv add <pkg>` (dev-only: `uv add --dev <pkg>`).
