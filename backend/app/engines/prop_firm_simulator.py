"""
Prop-Firm Challenge Simulator — Explore Concept #3
======================================================

Traders pay real money for funded-account challenges (FTMO-style):
hit a profit target within N days without breaching a MAX DAILY LOSS
limit (resets every day) or a MAX TOTAL DRAWDOWN limit (never resets).
The general Monte Carlo engine models one generic ruin threshold — it
doesn't distinguish a daily-resetting limit from a total one, and
prop-firm rules live and die by that distinction. This is a dedicated
simulator, not a reuse of the general engine, because the rule shape
is genuinely different.

Resamples the trader's own historical R-multiples (same honest
resampling approach as everywhere else in this platform) into
thousands of simulated challenge attempts, and reports the probability
of passing — split out by WHY simulated attempts failed, which is more
useful than a single pass/fail number.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from typing import List, Optional

from app.engines.monte_carlo_engine import TradeRecord


@dataclass
class PropFirmRules:
    name: str
    profit_target_pct: float
    max_daily_loss_pct: float
    max_total_drawdown_pct: float
    min_trading_days: int
    trades_per_day_estimate: int = 3


# A couple of representative, publicly-documented rule shapes. These
# are illustrative figures matching the STYLE of real prop-firm rules,
# not a live quote from any specific firm — always verify against the
# firm's current published terms before anyone relies on this for a
# real purchase decision. Challenge rules change without notice.
PROP_FIRM_PRESETS = {
    "generic_10_5_10": PropFirmRules(
        name="Generic Challenge (10% target / 5% daily / 10% total)",
        profit_target_pct=10.0, max_daily_loss_pct=5.0,
        max_total_drawdown_pct=10.0, min_trading_days=5,
    ),
    "generic_8_4_8_tight": PropFirmRules(
        name="Generic Tighter Challenge (8% target / 4% daily / 8% total)",
        profit_target_pct=8.0, max_daily_loss_pct=4.0,
        max_total_drawdown_pct=8.0, min_trading_days=4,
    ),
}


@dataclass
class ChallengeSimResult:
    trials: int
    rules_name: str
    probability_of_pass: float
    probability_of_fail_daily_loss: float
    probability_of_fail_total_drawdown: float
    probability_of_fail_time_limit: float
    median_days_to_target: Optional[float]
    notes: List[str] = field(default_factory=list)


class PropFirmChallengeSimulator:
    def __init__(self, trade_history: List[TradeRecord]):
        self.r_multiples = [t.r_multiple for t in trade_history]
        if len(self.r_multiples) < 10:
            raise ValueError("Need at least 10 historical trades to simulate a challenge")

    def simulate(
        self, rules: PropFirmRules, trials: int = 2000,
        risk_per_trade_pct: float = 1.0, max_days: int = 60, seed: Optional[int] = None,
    ) -> ChallengeSimResult:
        if seed is not None:
            random.seed(seed)

        passes = fail_daily = fail_total_dd = fail_time = 0
        days_to_target: List[int] = []

        for _ in range(trials):
            equity = 100.0   # tracked as % of starting capital
            peak = 100.0
            outcome = None

            for day in range(1, max_days + 1):
                day_start_equity = equity

                for _ in range(rules.trades_per_day_estimate):
                    r = random.choice(self.r_multiples)
                    equity += (risk_per_trade_pct / 100) * 100 * r
                    peak = max(peak, equity)

                    total_dd_pct = (peak - equity) / peak * 100 if peak > 0 else 0
                    if total_dd_pct >= rules.max_total_drawdown_pct:
                        outcome = "fail_total_dd"
                        break

                if outcome:
                    break

                day_loss_pct = (day_start_equity - equity) / day_start_equity * 100 if day_start_equity > 0 else 0
                if day_loss_pct >= rules.max_daily_loss_pct:
                    outcome = "fail_daily"
                    break

                profit_pct = equity - 100.0
                if profit_pct >= rules.profit_target_pct and day >= rules.min_trading_days:
                    outcome = "pass"
                    days_to_target.append(day)
                    break

            if outcome == "pass":
                passes += 1
            elif outcome == "fail_daily":
                fail_daily += 1
            elif outcome == "fail_total_dd":
                fail_total_dd += 1
            else:
                fail_time += 1

        notes = [
            "Rule figures are illustrative — always verify against the specific firm's "
            "current live terms before purchasing a challenge based on this estimate.",
        ]
        if trials < 1000:
            notes.append("Trial count under 1000 — results may be noisy; 2000+ recommended.")

        return ChallengeSimResult(
            trials=trials, rules_name=rules.name,
            probability_of_pass=round(passes / trials * 100, 2),
            probability_of_fail_daily_loss=round(fail_daily / trials * 100, 2),
            probability_of_fail_total_drawdown=round(fail_total_dd / trials * 100, 2),
            probability_of_fail_time_limit=round(fail_time / trials * 100, 2),
            median_days_to_target=(
                sorted(days_to_target)[len(days_to_target) // 2] if days_to_target else None
            ),
            notes=notes,
        )
