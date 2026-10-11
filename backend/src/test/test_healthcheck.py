async def test_healthcheck_returns_healthy(http_client):
    response = await http_client.get("/healthcheck")

    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}
    assert "X-Request-ID" in response.headers


async def test_echoes_inbound_request_id(http_client):
    response = await http_client.get("/healthcheck", headers={"X-Request-ID": "abc123"})

    assert response.headers["X-Request-ID"] == "abc123"


async def test_sets_security_headers(http_client):
    response = await http_client.get("/healthcheck")

    assert response.headers["Content-Security-Policy"] == "default-src 'none'"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Referrer-Policy"] == "no-referrer"


async def test_docs_page_is_exempt_from_the_strict_csp(http_client):
    response = await http_client.get("/docs")

    assert "Content-Security-Policy" not in response.headers
    assert response.headers["X-Frame-Options"] == "DENY"
