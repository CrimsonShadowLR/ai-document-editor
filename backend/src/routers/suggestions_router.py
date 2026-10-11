from fastapi import APIRouter, Depends, HTTPException

from ..llm import LlmNotConfiguredError, LlmRateLimitedError, LlmUnavailableError
from ..use_cases.suggestions import (
    CreateSuggestionHandler,
    CreateSuggestionRequest,
    MalformedSuggestionError,
    NoModelsConfiguredError,
    SuggestionResponse,
    UnknownModelError,
)

router = APIRouter(prefix="/suggestions", tags=["suggestions"])


@router.post("", response_model=SuggestionResponse)
async def create_suggestion(
    request: CreateSuggestionRequest, handler: CreateSuggestionHandler = Depends()
):
    try:
        return await handler.execute(request)
    except UnknownModelError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except (LlmNotConfiguredError, NoModelsConfiguredError) as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except LlmRateLimitedError as error:
        raise HTTPException(status_code=429, detail=str(error)) from error
    except (LlmUnavailableError, MalformedSuggestionError) as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
