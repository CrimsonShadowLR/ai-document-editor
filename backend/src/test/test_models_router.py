from ..config import get_configuration_variables


async def test_list_models_returns_configured_models_with_first_as_default(http_client):
    response = await http_client.get("/models")

    assert response.status_code == 200
    assert response.json() == {"models": ["model-a", "model-b"], "default": "model-a"}


async def test_list_models_is_empty_when_none_configured(http_client, monkeypatch):
    monkeypatch.setattr(get_configuration_variables(), "llm_models", " , ")

    response = await http_client.get("/models")

    assert response.json() == {"models": [], "default": None}
