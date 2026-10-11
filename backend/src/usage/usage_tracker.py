from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, datetime
from functools import lru_cache

from ..llm import TokenUsage


@dataclass
class UsageTotals:
    """Sums for a group of AI calls (all, one feature, or one model)."""

    requests: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    reasoning_tokens: int = 0
    cost_usd: float = 0.0
    # Calls whose provider reported no cost; cost_usd leaves them out.
    requests_without_cost: int = 0

    def add(self, usage: TokenUsage) -> None:
        self.requests += 1
        self.prompt_tokens += usage.prompt_tokens or 0
        self.completion_tokens += usage.completion_tokens or 0
        self.reasoning_tokens += usage.reasoning_tokens or 0
        if usage.cost_usd is None:
            self.requests_without_cost += 1
        else:
            self.cost_usd += usage.cost_usd


@dataclass
class UsageSnapshot:
    since: datetime
    total: UsageTotals
    by_feature: dict[str, UsageTotals]
    by_model: dict[str, UsageTotals]


@dataclass
class UsageTracker:
    """Token and cost totals of every completed AI call since the server started.

    In memory only: a restart starts from zero. For the full history, see the
    provider's dashboard (OpenRouter → Activity) or the ``llm.completed`` logs.
    """

    since: datetime = field(default_factory=lambda: datetime.now(UTC))
    total: UsageTotals = field(default_factory=UsageTotals)
    by_feature: defaultdict[str, UsageTotals] = field(default_factory=lambda: defaultdict(UsageTotals))
    by_model: defaultdict[str, UsageTotals] = field(default_factory=lambda: defaultdict(UsageTotals))

    def record(self, feature: str, model: str, usage: TokenUsage) -> None:
        self.total.add(usage)
        self.by_feature[feature].add(usage)
        self.by_model[model].add(usage)

    def snapshot(self) -> UsageSnapshot:
        return UsageSnapshot(
            since=self.since,
            total=self.total,
            by_feature=dict(self.by_feature),
            by_model=dict(self.by_model),
        )


@lru_cache
def get_usage_tracker() -> UsageTracker:
    """FastAPI dependency: one tracker for the whole process."""

    return UsageTracker()
