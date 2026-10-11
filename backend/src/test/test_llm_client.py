import httpx
import pytest

from ..llm import LlmClient, LlmNotConfiguredError, LlmRateLimitedError, LlmUnavailableError, TokenUsage
from ..llm.llm_client import _provider_error, _token_usage

MESSAGES = [{"role": "user", "content": "hi"}]


def _client(handler, api_key: str | None = "secret") -> LlmClient:
    return LlmClient(
        base_url="https://llm.test/v1/",
        api_key=api_key,
        timeout_seconds=5,
        transport=httpx.MockTransport(handler),
    )


def _completion(content):
    return {"choices": [{"message": {"content": content}}], "usage": {"prompt_tokens": 3}}


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
    [(429, LlmRateLimitedError), (401, LlmUnavailableError), (500, LlmUnavailableError)],
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


@pytest.mark.parametrize("body", [{"choices": []}, _completion("   "), _completion(None)])
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


@pytest.mark.parametrize(
    ("response", "expected"),
    [
        (httpx.Response(429, json={"error": {"message": "Rate limited upstream"}}), "Rate limited upstream"),
        (httpx.Response(502, text="Bad gateway"), "Bad gateway"),
        (httpx.Response(500, text=""), None),
        (httpx.Response(500, text="x" * 500), "x" * 300),
    ],
)
def test_provider_error_extracts_a_short_message(response, expected):
    assert _provider_error(response) == expected


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
