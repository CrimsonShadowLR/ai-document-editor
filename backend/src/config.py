from functools import lru_cache
from typing import Annotated

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class ConfigurationVariables(BaseSettings):
    """Environment-backed application configuration."""

    # The shared .env lives at the repo root; the backend runs from backend/.
    model_config = SettingsConfigDict(env_file="../.env", extra="ignore")

    log_level: Annotated[str, Field(alias="LOG_LEVEL", default="INFO")]
    # One JSON object per line (CloudWatch-friendly). False = colorized console.
    log_json: Annotated[bool, Field(alias="LOG_JSON", default=False)]
    # "local", "staging", "production" — attached to every log line.
    environment: Annotated[str, Field(alias="ENVIRONMENT", default="local")]

    # Comma-separated origins allowed to call the API cross-origin. Required,
    # no wildcard default: `allow_origins=["*"]` with credentials lets any site
    # call the API as the user.
    cors_origins: Annotated[str, Field(alias="CORS_ORIGINS", min_length=1)]

    # Any OpenAI-compatible /chat/completions API (Groq in dev, OpenRouter in
    # production). Switching provider only changes these three values.
    llm_base_url: Annotated[
        str, Field(alias="LLM_BASE_URL", default="https://openrouter.ai/api/v1")
    ]
    llm_api_key: Annotated[str | None, Field(alias="LLM_API_KEY", default=None)]
    # Comma-separated model IDs offered in the UI; the first is the default.
    llm_models: Annotated[str, Field(alias="LLM_MODELS", default="")]
    llm_timeout_seconds: Annotated[float, Field(alias="LLM_TIMEOUT_SECONDS", default=60.0)]

    @property
    def llm_models_list(self) -> list[str]:
        """Configured model IDs (trimmed, no empties), default first."""

        return [model.strip() for model in self.llm_models.split(",") if model.strip()]

    @property
    def cors_origins_list(self) -> list[str]:
        """Normalized list of allowed CORS origins (trimmed, no empties)."""

        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_configuration_variables() -> ConfigurationVariables:
    """Return the cached environment-backed application configuration."""

    return ConfigurationVariables()
