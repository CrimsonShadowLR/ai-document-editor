import time
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Literal, TypedDict

import httpx
import openai
import structlog
from openai import AsyncOpenAI

from ..config import get_configuration_variables
from .errors import LlmNotConfiguredError, LlmRateLimitedError, LlmUnavailableError

logger = structlog.get_logger(__name__)

# One automatic retry on 429/5xx/connection errors (the SDK backs off between
# tries). More would make a busy model feel stuck before the user can switch.
MAX_RETRIES = 1


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
    """Chat completions through the OpenAI SDK, against any OpenAI-compatible
    API (OpenRouter by default).

    Logs model, latency and token usage, never message content.
    """

    def __init__(
        self,
        base_url: str,
        api_key: str | None,
        timeout_seconds: float,
        max_retries: int = MAX_RETRIES,
        http_client: httpx.AsyncClient | None = None,
    ):
        # Created once and reused, so connections are pooled across requests.
        self._client = (
            AsyncOpenAI(
                api_key=api_key,
                base_url=base_url,
                timeout=timeout_seconds,
                max_retries=max_retries,
                http_client=http_client,
            )
            if api_key
            else None
        )

    async def complete(self, model: str, messages: list[ChatMessage]) -> Completion:
        """Return the assistant message text and token usage for one chat completion."""

        if self._client is None:
            raise LlmNotConfiguredError("LLM_API_KEY is not set in .env.")

        start = time.perf_counter()
        try:
            response = await self._client.chat.completions.create(
                model=model, messages=messages, temperature=0.4
            )
        except openai.APITimeoutError as error:
            raise LlmUnavailableError("The AI provider timed out.") from error
        except openai.APIConnectionError as error:
            raise LlmUnavailableError("Could not reach the AI provider.") from error
        except openai.APIStatusError as error:
            raise _status_error(error, model, _elapsed_ms(start)) from error

        duration_ms = _elapsed_ms(start)
        content = response.choices[0].message.content if response.choices else None
        if not isinstance(content, str) or not content.strip():
            raise LlmUnavailableError("The AI provider returned an empty response.")

        usage = _token_usage(response.usage.model_dump() if response.usage else None)
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


def _elapsed_ms(start: float) -> float:
    return round((time.perf_counter() - start) * 1000, 2)


def _status_error(error: openai.APIStatusError, model: str, duration_ms: float) -> Exception:
    """Map the provider's HTTP error (after the SDK's retries) to our domain errors."""

    status_code = error.status_code
    # The provider's own message says why (credits used up, model busy
    # upstream, ...). It never contains the document, only the error.
    logger.warning(
        "llm.failed",
        model=model,
        status_code=status_code,
        duration_ms=duration_ms,
        provider_error=_provider_error(error),
    )
    if status_code == 429:
        return LlmRateLimitedError(
            "This model is rate limited right now. Try again shortly or pick another model."
        )
    if status_code in (401, 403):
        return LlmUnavailableError("The AI provider rejected the API key.")
    if status_code == 402:
        return LlmUnavailableError("The AI provider account is out of credits.")
    if status_code >= 500:
        # OpenRouter answers 502/503 when the model's upstream is down or busy;
        # another model usually works.
        return LlmUnavailableError(
            f"The AI provider failed (HTTP {status_code}). Try again or pick another model."
        )
    return LlmUnavailableError(f"The AI provider failed (HTTP {status_code}).")


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


def _provider_error(error: openai.APIStatusError) -> str | None:
    """Best-effort short message from the provider's error body."""

    body = error.body
    message = body.get("message") if isinstance(body, dict) else None
    if not message:
        message = error.response.text
    return str(message)[:300] or None


@lru_cache
def get_llm_client() -> LlmClient:
    """FastAPI dependency: one client (and connection pool) per process.
    Tests override it with a fake."""

    config = get_configuration_variables()
    return LlmClient(
        base_url=config.llm_base_url,
        api_key=config.llm_api_key,
        timeout_seconds=config.llm_timeout_seconds,
    )
