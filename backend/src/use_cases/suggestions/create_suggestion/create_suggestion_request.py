from typing import Literal

from pydantic import Field, field_validator

from ...shared import BaseDataTransfer


# Which UI action started the call; only used to break down usage and cost.
SuggestionFeature = Literal["improve", "shorter", "formal", "custom", "refine"]


def _strip_non_blank(instruction: str) -> str:
    if not instruction.strip():
        raise ValueError("Instruction must not be blank")
    return instruction.strip()


class SuggestionTurn(BaseDataTransfer):
    """One earlier round of the same suggestion: what was asked, what came back."""

    instruction: str = Field(min_length=1, max_length=1_000)
    replacement: str = Field(max_length=20_000)

    @field_validator("instruction")
    @classmethod
    def _instruction_not_blank(cls, value: str) -> str:
        return _strip_non_blank(value)


class CreateSuggestionRequest(BaseDataTransfer):
    # The document is sent split around the selection instead of as text +
    # offsets: JS (UTF-16) and Python (code point) indices disagree on emoji.
    before: str = Field(default="", max_length=100_000)
    selection: str = Field(min_length=1, max_length=20_000)
    after: str = Field(default="", max_length=100_000)
    instruction: str = Field(min_length=1, max_length=1_000)
    model: str | None = None
    # Earlier refine rounds, oldest first; `instruction` is the newest request.
    turns: list[SuggestionTurn] = Field(default_factory=list, max_length=10)
    feature: SuggestionFeature = "custom"

    @field_validator("instruction")
    @classmethod
    def _instruction_not_blank(cls, value: str) -> str:
        return _strip_non_blank(value)
