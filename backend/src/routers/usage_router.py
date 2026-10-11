from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends

from ..usage import UsageTotals, UsageTracker, get_usage_tracker
from ..use_cases.shared import BaseDataTransfer

router = APIRouter(prefix="/usage", tags=["usage"])


class UsageTotalsResponse(BaseDataTransfer):
    requests: int
    prompt_tokens: int
    completion_tokens: int
    reasoning_tokens: int
    cost_usd: float
    requests_without_cost: int
    average_tokens_per_request: float
    average_cost_usd_per_request: float | None

    @classmethod
    def of(cls, totals: UsageTotals) -> "UsageTotalsResponse":
        priced = totals.requests - totals.requests_without_cost
        tokens = totals.prompt_tokens + totals.completion_tokens
        return cls(
            requests=totals.requests,
            prompt_tokens=totals.prompt_tokens,
            completion_tokens=totals.completion_tokens,
            reasoning_tokens=totals.reasoning_tokens,
            cost_usd=round(totals.cost_usd, 6),
            requests_without_cost=totals.requests_without_cost,
            average_tokens_per_request=round(tokens / totals.requests, 1) if totals.requests else 0,
            average_cost_usd_per_request=round(totals.cost_usd / priced, 6) if priced else None,
        )


class UsageResponse(BaseDataTransfer):
    since: datetime
    total: UsageTotalsResponse
    by_feature: dict[str, UsageTotalsResponse]
    by_model: dict[str, UsageTotalsResponse]


@router.get("", response_model=UsageResponse)
async def get_usage(tracker: Annotated[UsageTracker, Depends(get_usage_tracker)]) -> UsageResponse:
    """Tokens and cost of completed AI calls since the server started, per feature and model.

    Just a read of in-memory totals, so no use case.
    """

    snapshot = tracker.snapshot()
    return UsageResponse(
        since=snapshot.since,
        total=UsageTotalsResponse.of(snapshot.total),
        by_feature={name: UsageTotalsResponse.of(totals) for name, totals in snapshot.by_feature.items()},
        by_model={name: UsageTotalsResponse.of(totals) for name, totals in snapshot.by_model.items()},
    )
