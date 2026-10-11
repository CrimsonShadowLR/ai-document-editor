import time
import uuid

import structlog
from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from .config import get_configuration_variables
from .observability import configure_logging

_config = get_configuration_variables()
configure_logging(_config)

logger = structlog.get_logger("app.request")

app = FastAPI(title="API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_config.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next) -> Response:
    """Bind a per-request id and emit one access line per request.

    Honors an inbound ``X-Request-ID`` (else generates one), binds it into
    structlog's contextvars so every line logged during the request carries it,
    and echoes it back in the response header.
    """

    structlog.contextvars.clear_contextvars()
    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex
    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        method=request.method,
        path=request.url.path,
    )

    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        logger.exception("request.failed", duration_ms=duration_ms)
        raise

    duration_ms = round((time.perf_counter() - start) * 1000, 2)
    logger.info("request.handled", status_code=response.status_code, duration_ms=duration_ms)
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, error: Exception) -> Response:
    """Log any unhandled exception with a stack trace and return an opaque 500.

    Domain errors are mapped to 4xx in the routers; anything reaching here is a bug.
    """

    logger.exception("unhandled_exception", error_type=type(error).__name__)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, error: RequestValidationError) -> Response:
    """Log 422s (field locations + messages only, never the raw body)."""

    details = jsonable_encoder(error.errors())
    logger.warning("request.validation_error", errors=details)
    return JSONResponse(status_code=422, content={"detail": details})


@app.middleware("http")
async def add_security_headers(request: Request, call_next) -> Response:
    """Baseline hardening headers. The docs pages load assets from a CDN, so
    they're exempt from the strict CSP."""

    response = await call_next(request)
    if request.url.path not in {"/docs", "/redoc", "/openapi.json"}:
        response.headers.setdefault("Content-Security-Policy", "default-src 'none'")
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    return response


@app.get("/healthcheck", tags=["health"])
async def health_check() -> dict[str, str]:
    return {"status": "healthy"}
