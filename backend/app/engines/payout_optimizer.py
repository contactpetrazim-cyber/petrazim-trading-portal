"""
Funded-Account Payout Optimizer — Explore Concept #10
=========================================================

A trader running multiple funded prop-firm accounts simultaneously
needs to split risk across them without breaching any single account's
daily-loss or drawdown rules — breach one and that account is gone,
payout eligibility included. This allocates a trader's total
risk-taking across N accounts to maximize the number that stay
eligible for payout, rather than trading each account identically and
risking a correlated wipeout across all of them at once.

APPROACH: rather than a full portfolio-optimization solve (overkill
for what's fundamentally a small-N constraint problem), this uses a
straightforward proportional-risk allocation weighted by each
account's remaining cushion to its daily/total limits — accounts
closer to their limits get less risk allocated, accounts with more
room get more, capped so no single account's allocation alone could
breach its own daily limit even on the modeled worst-case trade.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List


@dataclass
class FundedAccount:
    account_id: str
    firm_name: str
    balance: float
    daily_loss_limit_pct: float       # e.g. 5.0
    total_drawdown_limit_pct: float   # e.g. 10.0
    current_daily_loss_pct: float     # how much of today's daily limit is already used, e.g. 1.2
    current_total_drawdown_pct: float # how much of the total limit is already used
    payout_eligible: bool = True      # False if already breached/disqualified


@dataclass
class AllocationResult:
    account_id: str
    risk_pct_allocated: float          # % of account balance to risk on the next trade
    remaining_daily_cushion_pct: float
    remaining_total_cushion_pct: float
    excluded: bool = False
    exclusion_reason: str = ""


@dataclass
class PayoutOptimizerReport:
    allocations: List[AllocationResult] = field(default_factory=list)
    total_accounts: int = 0
    accounts_allocated: int = 0
    accounts_excluded: int = 0
    notes: List[str] = field(default_factory=list)


class PayoutOptimizer:
    def __init__(self, safety_margin_pct: float = 20.0, max_risk_per_trade_pct: float = 1.0):
        """safety_margin_pct: never allocate risk that could consume more
        than (100 - safety_margin_pct)% of an account's REMAINING cushion
        on a single worst-case trade — keeps a buffer rather than sizing
        right up to the edge of a limit.
        max_risk_per_trade_pct: hard ceiling regardless of cushion, since
        a huge remaining cushion is never a reason to risk more than a
        sane fixed-fractional amount on one trade."""
        self.safety_margin_pct = safety_margin_pct
        self.max_risk_per_trade_pct = max_risk_per_trade_pct

    def optimize(self, accounts: List[FundedAccount]) -> PayoutOptimizerReport:
        if not accounts:
            raise ValueError("Need at least one funded account to optimize")

        allocations: List[AllocationResult] = []
        notes: List[str] = []

        for acc in accounts:
            daily_cushion = acc.daily_loss_limit_pct - acc.current_daily_loss_pct
            total_cushion = acc.total_drawdown_limit_pct - acc.current_total_drawdown_pct
            binding_cushion = min(daily_cushion, total_cushion)

            if not acc.payout_eligible:
                allocations.append(AllocationResult(
                    account_id=acc.account_id, risk_pct_allocated=0.0,
                    remaining_daily_cushion_pct=round(daily_cushion, 2),
                    remaining_total_cushion_pct=round(total_cushion, 2),
                    excluded=True, exclusion_reason="Account already flagged as not payout-eligible.",
                ))
                continue

            if binding_cushion <= 0:
                allocations.append(AllocationResult(
                    account_id=acc.account_id, risk_pct_allocated=0.0,
                    remaining_daily_cushion_pct=round(daily_cushion, 2),
                    remaining_total_cushion_pct=round(total_cushion, 2),
                    excluded=True, exclusion_reason="No remaining cushion on daily or total limit — stop trading this account today.",
                ))
                continue

            safe_risk = binding_cushion * (1 - self.safety_margin_pct / 100)
            risk_allocated = min(safe_risk, self.max_risk_per_trade_pct)

            allocations.append(AllocationResult(
                account_id=acc.account_id, risk_pct_allocated=round(max(risk_allocated, 0), 3),
                remaining_daily_cushion_pct=round(daily_cushion, 2),
                remaining_total_cushion_pct=round(total_cushion, 2),
            ))

        excluded_count = sum(1 for a in allocations if a.excluded)
        if excluded_count > 0:
            notes.append(
                f"{excluded_count} of {len(accounts)} account(s) excluded from allocation this round "
                "— see exclusion_reason on each. Trading them anyway risks losing payout eligibility entirely."
            )
        notes.append(
            "This is a risk-sizing guide, not an execution guarantee — actual trade outcomes still "
            "depend on the strategy itself. Re-run this after every trading day, since cushions shift daily."
        )

        return PayoutOptimizerReport(
            allocations=allocations, total_accounts=len(accounts),
            accounts_allocated=len(accounts) - excluded_count, accounts_excluded=excluded_count,
            notes=notes,
        )
