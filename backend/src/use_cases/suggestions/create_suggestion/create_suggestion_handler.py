from typing import Annotated

from fastapi import Depends

from ....config import get_configuration_variables
from ....llm import LlmClient, get_llm_client
from ...shared import BaseHandler
from ..errors import NoModelsConfiguredError, UnknownModelError
from ..suggestion_response import SuggestionResponse
from .create_suggestion_request import CreateSuggestionRequest
from .prompt import build_messages, parse_completion


class CreateSuggestionHandler(BaseHandler[CreateSuggestionRequest, SuggestionResponse]):
    def __init__(self, llm_client: Annotated[LlmClient, Depends(get_llm_client)]):
        self._llm_client = llm_client

    async def execute(self, request: CreateSuggestionRequest) -> SuggestionResponse:
        models = get_configuration_variables().llm_models_list
        if not models:
            raise NoModelsConfiguredError("LLM_MODELS is not set in .env.")
        model = request.model or models[0]
        if model not in models:
            raise UnknownModelError(f"Model '{model}' is not available.")

        completion = await self._llm_client.complete(model, build_messages(request))
        replacement, reason = parse_completion(completion)
        return SuggestionResponse(replacement=replacement, reason=reason, model=model)
