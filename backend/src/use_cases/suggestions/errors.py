class NoModelsConfiguredError(Exception):
    """LLM_MODELS is empty, so there is no model to call."""


class UnknownModelError(Exception):
    """The requested model is not in the configured list."""


class MalformedSuggestionError(Exception):
    """The model answered without the expected <replacement> tags."""
