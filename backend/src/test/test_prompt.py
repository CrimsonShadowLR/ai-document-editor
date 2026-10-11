import pytest

from ..use_cases.suggestions import CreateSuggestionRequest, MalformedSuggestionError
from ..use_cases.suggestions.create_suggestion.prompt import build_messages, parse_completion


def test_parses_replacement_and_reason():
    text = "<replacement>\nNew text.\n</replacement>\n<reason> Shorter. </reason>"

    assert parse_completion(text) == ("New text.", "Shorter.")


def test_keeps_inner_whitespace_and_markdown():
    text = "<replacement>\n- one\n- two\n\n**bold**\n</replacement>"

    assert parse_completion(text) == ("- one\n- two\n\n**bold**", None)


def test_ignores_text_around_the_tags():
    text = "<think>planning…</think>\nHere you go:\n<replacement>Fixed.</replacement><reason>Typo.</reason>"

    assert parse_completion(text) == ("Fixed.", "Typo.")


def test_empty_reason_becomes_none():
    assert parse_completion("<replacement>x</replacement><reason>  </reason>") == ("x", None)


def test_missing_replacement_raises():
    with pytest.raises(MalformedSuggestionError):
        parse_completion("Just some text")


def test_takes_the_last_block_when_the_model_drafts_first():
    text = (
        "<think>Draft: <replacement>draft</replacement><reason>draft reason</reason></think>\n"
        "<replacement>\nFinal.\n</replacement>\n<reason>Final reason.</reason>"
    )

    assert parse_completion(text) == ("Final.", "Final reason.")


def test_stray_opening_tag_does_not_swallow_the_answer():
    text = "I will answer in <replacement> tags.\n<replacement>Fixed.</replacement>"

    assert parse_completion(text) == ("Fixed.", None)


def test_normalizes_crlf_line_endings():
    text = "<replacement>\r\n- one\r\n- two\r\n</replacement><reason>List.</reason>"

    assert parse_completion(text) == ("- one\n- two", "List.")


def test_build_messages_replays_each_refine_round_in_order():
    request = CreateSuggestionRequest(
        before="A ",
        selection="b",
        after=" c",
        instruction="Third",
        turns=[
            {"instruction": "First", "replacement": "one"},
            {"instruction": "Second", "replacement": "two"},
        ],
    )

    messages = build_messages(request)

    assert [message["role"] for message in messages] == [
        "system", "user", "assistant", "user", "assistant", "user",
    ]
    assert messages[1]["content"] == "Document:\n\nA <selection>b</selection> c\n\nInstruction: First"
    assert messages[2]["content"] == "<replacement>\none\n</replacement>"
    assert messages[3]["content"].endswith("Instruction: Second")
    assert messages[4]["content"] == "<replacement>\ntwo\n</replacement>"
    assert messages[5]["content"].endswith("Instruction: Third")
