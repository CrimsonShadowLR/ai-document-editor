async def test_healthcheck_returns_healthy(http_client):
    response = await http_client.get("/healthcheck")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}
    assert "X-Request-ID" in response.headers
