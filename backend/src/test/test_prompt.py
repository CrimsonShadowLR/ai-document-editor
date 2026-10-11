import pytest

from ..use_cases.suggestions import MalformedSuggestionError
from ..use_cases.suggestions.create_suggestion.prompt import parse_completion


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
