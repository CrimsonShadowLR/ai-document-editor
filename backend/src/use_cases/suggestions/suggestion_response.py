from ..shared import BaseDataTransfer


class SuggestionResponse(BaseDataTransfer):
    replacement: str
    reason: str | None
    model: str
