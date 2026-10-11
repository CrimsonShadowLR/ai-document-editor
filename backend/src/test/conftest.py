import os

os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")

# App imports must come after the env is set: config is read at import time.
import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from ..main import app  # noqa: E402


@pytest_asyncio.fixture
async def http_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
