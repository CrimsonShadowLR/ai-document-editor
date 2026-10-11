import os

# Set explicitly (not setdefault): env vars win over the repo's .env file, so
# tests never pick up a real API key or model list.
os.environ["CORS_ORIGINS"] = "http://localhost:5173"
os.environ["LLM_BASE_URL"] = "https://llm.test/v1"
os.environ["LLM_API_KEY"] = "test-key"
os.environ["LLM_MODELS"] = "model-a,model-b"

# App imports must come after the env is set: config is read at import time.
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from ..main import app  # noqa: E402


@pytest_asyncio.fixture
async def http_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
