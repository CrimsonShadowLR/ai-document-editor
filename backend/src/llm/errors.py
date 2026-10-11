class LlmError(Exception):
    """Base class for failures talking to the LLM provider."""


class LlmNotConfiguredError(LlmError):
    """No API key is set, so no request can be made."""


class LlmRateLimitedError(LlmError):
    """The provider rejected the request with HTTP 429."""


class LlmUnavailableError(LlmError):
    """The provider timed out, failed, or returned an unusable response."""
