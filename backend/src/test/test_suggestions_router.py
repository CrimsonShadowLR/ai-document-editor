import pytest

from ..config import get_configuration_variables
from ..llm import (
    ChatMessage,
    LlmNotConfiguredError,
    LlmRateLimitedError,
    LlmUnavailableError,
    get_llm_client,
)
from ..main import app


class FakeLlmClient:
    """Stands in for the provider: records calls, returns a canned answer or raises."""

    def __init__(self):
        self.answer = "<replacement>\nA tighter sentence.\n</replacement>\n<reason>Cut filler.</reason>"
        self.error: Exception | None = None
        self.calls: list[tuple[str, list[ChatMessage]]] = []

    async def complete(self, model: str, messages: list[ChatMessage]) -> str:
        self.calls.append((model, messages))
        if self.error:
            raise self.error
        return self.answer


@pytest.fixture
def fake_llm():
    fake = FakeLlmClient()
    app.dependency_overrides[get_llm_client] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_llm_client, None)


def _body(**overrides):
    body = {
        "before": "# Title\n\n",
        "selection": "This is a sentence that is really quite long.",
        "after": "\n\nMore text.",
        "instruction": "Make it shorter",
    }
    body.update(overrides)
    return body


async def test_returns_replacement_reason_and_default_model(http_client, fake_llm):
    response = await http_client.post("/suggestions", json=_body())

    assert response.status_code == 200
    assert response.json() == {
        "replacement": "A tighter sentence.",
        "reason": "Cut filler.",
        "model": "model-a",
    }
    model, messages = fake_llm.calls[0]
    assert model == "model-a"
    assert "<selection>This is a sentence that is really quite long.</selection>" in messages[1]["content"]


async def test_uses_the_requested_model(http_client, fake_llm):
    response = await http_client.post("/suggestions", json=_body(model="model-b"))

    assert response.status_code == 200
    assert fake_llm.calls[0][0] == "model-b"


async def test_refine_turns_are_sent_as_conversation(http_client, fake_llm):
    body = _body(
        instruction="Now more formal",
        turns=[{"instruction": "Make it shorter", "replacement": "A short one."}],
    )

    await http_client.post("/suggestions", json=body)

    roles = [message["role"] for message in fake_llm.calls[0][1]]
    assert roles == ["system", "user", "assistant", "user"]
    assert fake_llm.calls[0][1][1]["content"].endswith("Instruction: Make it shorter")
    assert "A short one." in fake_llm.calls[0][1][2]["content"]
    assert fake_llm.calls[0][1][3]["content"].endswith("Instruction: Now more formal")


async def test_unknown_model_is_rejected(http_client, fake_llm):
    response = await http_client.post("/suggestions", json=_body(model="not-allowed"))

    assert response.status_code == 400
    assert fake_llm.calls == []


async def test_blank_instruction_is_rejected(http_client, fake_llm):
    response = await http_client.post("/suggestions", json=_body(instruction="   "))

    assert response.status_code == 422


async def test_empty_selection_is_rejected(http_client, fake_llm):
    response = await http_client.post("/suggestions", json=_body(selection=""))

    assert response.status_code == 422


async def test_no_models_configured_returns_503(http_client, fake_llm, monkeypatch):
    monkeypatch.setattr(get_configuration_variables(), "llm_models", "")

    response = await http_client.post("/suggestions", json=_body())

    assert response.status_code == 503


@pytest.mark.parametrize(
    ("error", "status_code"),
    [
        (LlmNotConfiguredError("no key"), 503),
        (LlmRateLimitedError("slow down"), 429),
        (LlmUnavailableError("down"), 502),
    ],
)
async def test_provider_errors_map_to_status_codes(http_client, fake_llm, error, status_code):
    fake_llm.error = error

    response = await http_client.post("/suggestions", json=_body())

    assert response.status_code == status_code
    assert response.json()["detail"] == str(error)


async def test_answer_without_tags_returns_502(http_client, fake_llm):
    fake_llm.answer = "Sure! Here is a shorter version: A tighter sentence."

    response = await http_client.post("/suggestions", json=_body())

    assert response.status_code == 502


async def test_more_than_ten_refine_turns_is_rejected(http_client, fake_llm):
    turns = [{"instruction": f"Round {n}", "replacement": "x"} for n in range(11)]

    response = await http_client.post("/suggestions", json=_body(turns=turns))

    assert response.status_code == 422
    assert fake_llm.calls == []


async def test_blank_turn_instruction_is_rejected(http_client, fake_llm):
    response = await http_client.post(
        "/suggestions", json=_body(turns=[{"instruction": "  ", "replacement": "x"}])
    )

    assert response.status_code == 422


async def test_turn_instruction_is_stripped(http_client, fake_llm):
    await http_client.post(
        "/suggestions", json=_body(turns=[{"instruction": " Shorter \n", "replacement": "x"}])
    )

    assert fake_llm.calls[0][1][1]["content"].endswith("Instruction: Shorter")


async def test_unexpected_error_returns_opaque_500_with_request_id_and_headers(http_client, fake_llm):
    fake_llm.error = RuntimeError("bug with secret details")

    response = await http_client.post("/suggestions", json=_body(), headers={"X-Request-ID": "req-1"})

    assert response.status_code == 500
    assert response.json() == {"detail": "Internal server error"}
    assert response.headers["X-Request-ID"] == "req-1"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
