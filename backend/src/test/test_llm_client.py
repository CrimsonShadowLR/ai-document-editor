import httpx
import pytest
from structlog.testing import capture_logs

from ..llm import LlmClient, LlmNotConfiguredError, LlmRateLimitedError, LlmUnavailableError, TokenUsage
from ..llm.llm_client import _token_usage

MESSAGES = [{"role": "user", "content": "hi"}]


def _client(handler, api_key: str | None = "secret", max_retries: int = 0) -> LlmClient:
    return LlmClient(
        base_url="https://llm.test/v1/",
        api_key=api_key,
        timeout_seconds=5,
        max_retries=max_retries,
        http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )


def _completion(content):
    return {
        "id": "gen-1",
        "object": "chat.completion",
        "created": 0,
        "model": "model-a",
        "choices": [
            {"index": 0, "finish_reason": "stop", "message": {"role": "assistant", "content": content}}
        ],
        "usage": {"prompt_tokens": 3, "completion_tokens": 1, "total_tokens": 4, "cost": 0.00002},
    }


async def test_posts_chat_completion_and_returns_content():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["auth"] = request.headers["Authorization"]
        seen["body"] = request.read()
        return httpx.Response(200, json=_completion("hello"))

    completion = await _client(handler).complete("model-a", MESSAGES)
    assert completion.content == "hello"
    assert completion.usage.prompt_tokens == 3
    # OpenRouter's extra `cost` field survives the SDK's typed response.
    assert completion.usage.cost_usd == 0.00002
    assert seen["url"] == "https://llm.test/v1/chat/completions"
    assert seen["auth"] == "Bearer secret"
    assert b'"model":"model-a"' in seen["body"]


async def test_missing_api_key_raises_before_any_request():
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("must not be called")

    with pytest.raises(LlmNotConfiguredError):
        await _client(handler, api_key=None).complete("model-a", MESSAGES)


@pytest.mark.parametrize(
    ("status_code", "error_type"),
    [
        (429, LlmRateLimitedError),
        (401, LlmUnavailableError),
        (402, LlmUnavailableError),
        (500, LlmUnavailableError),
    ],
)
async def test_http_errors_map_to_domain_errors(status_code, error_type):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code, json={"error": "nope"})

    with pytest.raises(error_type):
        await _client(handler).complete("model-a", MESSAGES)


async def test_timeout_raises_unavailable():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    with pytest.raises(LlmUnavailableError):
        await _client(handler).complete("model-a", MESSAGES)


@pytest.mark.parametrize("body", [{**_completion("x"), "choices": []}, _completion("   "), _completion(None)])
async def test_unusable_response_raises_unavailable(body):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=body)

    with pytest.raises(LlmUnavailableError):
        await _client(handler).complete("model-a", MESSAGES)


async def test_upstream_5xx_suggests_another_model():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={"error": {"message": "No endpoints available"}})

    with pytest.raises(LlmUnavailableError, match="pick another model"):
        await _client(handler).complete("model-a", MESSAGES)


async def test_out_of_credits_says_so():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(402, json={"error": {"message": "Insufficient credits"}})

    with pytest.raises(LlmUnavailableError, match="out of credits"):
        await _client(handler).complete("model-a", MESSAGES)


async def test_retries_once_then_succeeds():
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if len(calls) == 1:
            return httpx.Response(429, json={"error": {"message": "busy"}}, headers={"retry-after-ms": "10"})
        return httpx.Response(200, json=_completion("hello"))

    completion = await _client(handler, max_retries=1).complete("model-a", MESSAGES)

    assert completion.content == "hello"
    assert len(calls) == 2


@pytest.mark.parametrize(
    ("response", "expected"),
    [
        (httpx.Response(429, json={"error": {"message": "Rate limited upstream"}}), "Rate limited upstream"),
        (httpx.Response(502, text="Bad gateway"), "Bad gateway"),
        (httpx.Response(500, text="x" * 500), "x" * 300),
    ],
)
async def test_failure_log_carries_the_provider_message(response, expected):
    def handler(request: httpx.Request) -> httpx.Response:
        return response

    with capture_logs() as logs, pytest.raises((LlmRateLimitedError, LlmUnavailableError)):
        await _client(handler).complete("model-a", MESSAGES)

    failed = [entry for entry in logs if entry["event"] == "llm.failed"]
    assert failed[0]["provider_error"] == expected


def test_token_usage_reads_openrouter_cost_and_reasoning_tokens():
    usage = _token_usage(
        {
            "prompt_tokens": 205,
            "completion_tokens": 194,
            "completion_tokens_details": {"reasoning_tokens": 150},
            "cost": 0.00012,
        }
    )

    assert usage == TokenUsage(prompt_tokens=205, completion_tokens=194, reasoning_tokens=150, cost_usd=0.00012)


@pytest.mark.parametrize("raw", [None, "nope", {"prompt_tokens": "12", "cost": True}])
def test_token_usage_tolerates_missing_or_odd_values(raw):
    assert _token_usage(raw) == TokenUsage()
