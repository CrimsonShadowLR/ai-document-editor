"""Logging wiring.

Routes structlog *and* stdlib ``logging`` (uvicorn, httpx, libraries)
through one renderer: JSON in deployed environments, a colorized console
locally. The per-request ``request_id`` bound in ``bootstrap`` is merged into
every line via ``merge_contextvars``.
"""

import logging

import structlog

from .config import ConfigurationVariables

# Log-context keys that must never reach a sink verbatim. Call sites shouldn't
# log these anyway; this is the backstop.
_REDACT_KEYS = frozenset(
    {"token", "access_token", "id_token", "refresh_token", "authorization", "password", "secret", "api_key"}
)


def _redact_sensitive_context(logger: object, method_name: str, event_dict: dict) -> dict:
    for key in event_dict:
        if key.lower() in _REDACT_KEYS:
            event_dict[key] = "***REDACTED***"
    return event_dict


_SHARED_PROCESSORS: list = [
    structlog.contextvars.merge_contextvars,
    structlog.processors.add_log_level,
    structlog.processors.TimeStamper(fmt="iso"),
    structlog.processors.StackInfoRenderer(),
    _redact_sensitive_context,
]


def configure_logging(config: ConfigurationVariables) -> None:
    """Route structlog and stdlib logging through one renderer. Idempotent."""

    renderer: structlog.types.Processor = (
        structlog.processors.JSONRenderer()
        if config.log_json
        else structlog.dev.ConsoleRenderer(colors=True)
    )

    structlog.configure(
        processors=[
            *_SHARED_PROCESSORS,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=_SHARED_PROCESSORS,
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler()
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(config.log_level.upper())

    # Let uvicorn's records propagate to our handler so they share the format.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers.clear()
        uvicorn_logger.propagate = True

    # The request middleware already emits one `request.handled` line per
    # request; uvicorn's access log would duplicate it.
    logging.getLogger("uvicorn.access").disabled = True
