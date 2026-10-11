from fastapi import APIRouter

from ..config import get_configuration_variables
from ..use_cases.shared import BaseDataTransfer

router = APIRouter(prefix="/models", tags=["models"])


class ModelsResponse(BaseDataTransfer):
    models: list[str]
    default: str | None


@router.get("", response_model=ModelsResponse)
async def list_models() -> ModelsResponse:
    """Models offered in the UI picker, straight from config (no use case needed)."""

    models = get_configuration_variables().llm_models_list
    return ModelsResponse(models=models, default=models[0] if models else None)
