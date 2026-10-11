from ..llm import TokenUsage


async def test_usage_starts_empty(http_client):
    response = await http_client.get("/usage")

    assert response.status_code == 200
    body = response.json()
    assert body["total"]["requests"] == 0
    assert body["byFeature"] == {}
    assert body["total"]["averageCostUsdPerRequest"] is None


async def test_usage_sums_and_averages(http_client, usage_tracker):
    usage_tracker.record("improve", "model-a", TokenUsage(prompt_tokens=100, completion_tokens=20, cost_usd=0.001))
    usage_tracker.record("improve", "model-a", TokenUsage(prompt_tokens=300, completion_tokens=60, cost_usd=0.003))
    usage_tracker.record("refine", "model-b", TokenUsage(prompt_tokens=50, completion_tokens=10))

    body = (await http_client.get("/usage")).json()

    improve = body["byFeature"]["improve"]
    assert improve["requests"] == 2
    assert improve["promptTokens"] == 400
    assert improve["costUsd"] == 0.004
    assert improve["averageTokensPerRequest"] == 240.0
    assert improve["averageCostUsdPerRequest"] == 0.002
    # A provider that reports no cost is counted, but left out of the cost.
    assert body["byModel"]["model-b"]["requestsWithoutCost"] == 1
    assert body["byModel"]["model-b"]["averageCostUsdPerRequest"] is None
    assert body["total"]["requests"] == 3
