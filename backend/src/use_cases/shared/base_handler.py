from __future__ import annotations

import functools
from abc import abstractmethod
from typing import Any, Generic, TypeVar

import structlog

from .base_data_transfer import BaseDataTransfer

TRequest = TypeVar("TRequest", bound=BaseDataTransfer)
TResponse = TypeVar("TResponse")

logger = structlog.get_logger("app.handler")


def _wrap_execute_with_logging(cls: type) -> None:
    """Wrap a subclass's own ``execute`` with start/completed/failed log lines.

    Failures log at WARNING with the error type only: handlers routinely raise
    expected domain errors that routers map to 4xx/5xx.
    Genuinely unhandled exceptions still get a stack trace from the request
    middleware in ``bootstrap.py``.
    """

    method = cls.__dict__.get("execute")
    if method is None or getattr(method, "_logging_wrapped", False):
        return

    handler_name = cls.__name__

    @functools.wraps(method)
    async def execute_with_logging(self: Any, *args: Any, **kwargs: Any) -> Any:
        logger.info("handler.start", handler=handler_name)
        try:
            result = await method(self, *args, **kwargs)
        except Exception as error:
            logger.warning("handler.failed", handler=handler_name, error_type=type(error).__name__)
            raise
        logger.info("handler.completed", handler=handler_name)
        return result

    execute_with_logging._logging_wrapped = True  # type: ignore[attr-defined]
    setattr(cls, "execute", execute_with_logging)


class BaseHandler(Generic[TRequest, TResponse]):
    """One class per use case. Routers receive it via ``handler: X = Depends()``."""

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        _wrap_execute_with_logging(cls)

    @abstractmethod
    async def execute(self, request: TRequest) -> TResponse:
        pass
