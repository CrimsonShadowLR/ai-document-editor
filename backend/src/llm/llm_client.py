import time
from dataclasses import dataclass
from typing import Any, Literal, TypedDict

import httpx
import structlog

from ..config import get_configuration_variables
from .errors import LlmNotConfiguredError, LlmRateLimitedError, LlmUnavailableError

logger = structlog.get_logger(__name__)


class ChatMessage(TypedDict):
    role: Literal["system", "user", "assistant"]
    content: str


@dataclass(frozen=True)
class TokenUsage:
    """What one call consumed, as reported by the provider (None when it doesn't say)."""

    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    reasoning_tokens: int | None = None
    # OpenRouter returns the cost in USD with every response; other providers may not.
    cost_usd: float | None = None


@dataclass(frozen=True)
class Completion:
    content: str
    usage: TokenUsage


class LlmClient:
    """Minimal client for an OpenAI-compatible ``/chat/completions`` API.

    Logs model, latency and token usage, never message content.
    """

    def __init__(
        self,
        base_url: str,
        api_key: str | None,
        timeout_seconds: float,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._timeout_seconds = timeout_seconds
        self._transport = transport

    async def complete(self, model: str, messages: list[ChatMessage]) -> Completion:
        """Return the assistant message text and token usage for one chat completion."""

        if not self._api_key:
            raise LlmNotConfiguredError("LLM_API_KEY is not set in .env.")

        start = time.perf_counter()
        try:
            async with httpx.AsyncClient(
                transport=self._transport, timeout=self._timeout_seconds
            ) as client:
                response = await client.post(
                    f"{self._base_url}/chat/completions",
                    headers={"Authorization": f"Bearer {self._api_key}"},
                    json={"model": model, "messages": messages, "temperature": 0.4},
                )
        except httpx.TimeoutException as error:
            raise LlmUnavailableError("The AI provider timed out.") from error
        except httpx.HTTPError as error:
            raise LlmUnavailableError("Could not reach the AI provider.") from error

        duration_ms = round((time.perf_counter() - start) * 1000, 2)

        if response.is_error:
            # The provider's own message says why (daily quota, model busy
            # upstream, ...). It never contains the document, only the error.
            provider_error = _provider_error(response)
            logger.warning(
                "llm.failed",
                model=model,
                status_code=response.status_code,
                duration_ms=duration_ms,
                provider_error=provider_error,
            )
            if response.status_code == 429:
                raise LlmRateLimitedError(
                    "This model is rate limited right now. Try again shortly or pick another model."
                )
            if response.status_code in (401, 403):
                raise LlmUnavailableError("The AI provider rejected the API key.")
            if response.status_code >= 500:
                # OpenRouter answers 502/503 when the model's upstream is down
                # or busy; another model usually works.
                raise LlmUnavailableError(
                    f"The AI provider failed (HTTP {response.status_code}). "
                    "Try again or pick another model."
                )
            raise LlmUnavailableError(f"The AI provider failed (HTTP {response.status_code}).")

        try:
            body = response.json()
            content = body["choices"][0]["message"]["content"]
        except (ValueError, KeyError, IndexError, TypeError) as error:
            raise LlmUnavailableError("The AI provider returned an unexpected response.") from error
        if not isinstance(content, str) or not content.strip():
            raise LlmUnavailableError("The AI provider returned an empty response.")

        usage = _token_usage(body.get("usage"))
        logger.info(
            "llm.completed",
            model=model,
            duration_ms=duration_ms,
            prompt_tokens=usage.prompt_tokens,
            completion_tokens=usage.completion_tokens,
            reasoning_tokens=usage.reasoning_tokens,
            cost_usd=usage.cost_usd,
        )
        return Completion(content=content, usage=usage)


def _token_usage(raw: Any) -> TokenUsage:
    """Read the OpenAI-style ``usage`` object; missing or odd values become None."""

    if not isinstance(raw, dict):
        return TokenUsage()

    def number(value: Any) -> float | None:
        # bool is an int subclass; never count True as a token.
        return value if isinstance(value, (int, float)) and not isinstance(value, bool) else None

    def integer(value: Any) -> int | None:
        parsed = number(value)
        return int(parsed) if parsed is not None else None

    details = raw.get("completion_tokens_details")
    reasoning = details.get("reasoning_tokens") if isinstance(details, dict) else None
    cost = number(raw.get("cost"))
    return TokenUsage(
        prompt_tokens=integer(raw.get("prompt_tokens")),
        completion_tokens=integer(raw.get("completion_tokens")),
        reasoning_tokens=integer(reasoning),
        cost_usd=float(cost) if cost is not None else None,
    )


def _provider_error(response: httpx.Response) -> str | None:
    """Best-effort short error message from an OpenAI-style error body."""

    try:
        message = response.json()["error"]["message"]
    except (ValueError, KeyError, TypeError):
        message = response.text
    return str(message)[:300] or None


def get_llm_client() -> LlmClient:
    """FastAPI dependency; tests override it with a fake."""

    config = get_configuration_variables()
    return LlmClient(
        base_url=config.llm_base_url,
        api_key=config.llm_api_key,
        timeout_seconds=config.llm_timeout_seconds,
    )
