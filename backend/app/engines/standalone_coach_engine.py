"""
Standalone Probability Coach — Explore Concept #1
=====================================================

Lets ANY trader — not just Petrazim's own bots — upload their own
closed-trade history and get the same kind of Monte Carlo forecast +
coach-style read that the internal Weekly Review Engine gives bots.
This is the core of a standalone product: "upload your trades, get an
honest probability read," sellable on its own or as a funnel into the
full platform.

Reuses MonteCarloEngine entirely — no duplicated simulation logic.
This file is CSV ingestion + a narrative layer on top.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from typing import List, Optional

from app.engines.monte_carlo_engine import MonteCarloEngine, TradeRecord

MIN_TRADES_TO_RUN = 5
MIN_TRADES_FOR_CONFIDENCE = 30


@dataclass
class UploadedTradeParseResult:
    trades: List[TradeRecord]
    skipped_rows: int
    errors: List[str] = field(default_factory=list)


def parse_trade_csv(
    csv_text: str, r_multiple_column: str = "r_multiple", trade_id_column: str = "trade_id"
) -> UploadedTradeParseResult:
    """Expects a CSV with at least an r_multiple column (R-multiples —
    e.g. +2.0 for a 2R win, -1.0 for a full stop loss). Any other
    columns are ignored. trade_id_column is optional; rows without it
    get an auto-generated id."""
    reader = csv.DictReader(io.StringIO(csv_text))
    trades: List[TradeRecord] = []
    errors: List[str] = []
    skipped = 0

    for i, row in enumerate(reader):
        try:
            r = float(row[r_multiple_column])
            tid = row.get(trade_id_column) or f"row_{i}"
            trades.append(TradeRecord(trade_id=tid, r_multiple=r))
        except (KeyError, ValueError, TypeError) as e:
            skipped += 1
            if len(errors) < 10:
                errors.append(f"Row {i}: {e}")

    return UploadedTradeParseResult(trades=trades, skipped_rows=skipped, errors=errors)


@dataclass
class StandaloneCoachReport:
    n_trades: int
    win_rate: float
    expectancy_r: float
    median_outcome_multiple: float
    p5_outcome_multiple: float
    p95_outcome_multiple: float
    probability_of_ruin: float
    coach_narrative: str
    data_quality_notes: List[str] = field(default_factory=list)


class StandaloneCoachEngine:
    def analyze(
        self, trades: List[TradeRecord], starting_equity: float = 10000.0,
        trials: int = 2000, seed: Optional[int] = None,
    ) -> StandaloneCoachReport:
        if len(trades) < MIN_TRADES_TO_RUN:
            raise ValueError(f"Need at least {MIN_TRADES_TO_RUN} trades to run any analysis")

        engine = MonteCarloEngine(trades)
        metrics = engine.compute_metrics()
        result = engine.run_simulation(
            trials=trials, trades_per_trial=max(len(trades), 20),
            starting_equity=starting_equity, resample_mode="block",
            block_size=min(5, max(1, len(trades) // 4)), seed=seed,
        )

        notes: List[str] = []
        if len(trades) < MIN_TRADES_FOR_CONFIDENCE:
            notes.append(
                f"Only {len(trades)} trades — treat this as a rough read, not a verdict. "
                f"{MIN_TRADES_FOR_CONFIDENCE}+ is where this starts to mean something statistically."
            )

        narrative = self._build_narrative(metrics, result, len(trades))

        return StandaloneCoachReport(
            n_trades=len(trades),
            win_rate=metrics.win_rate,
            expectancy_r=metrics.expectancy_r,
            median_outcome_multiple=round(result.final_equity_percentiles.get(50, starting_equity) / starting_equity, 3),
            p5_outcome_multiple=round(result.final_equity_percentiles.get(5, starting_equity) / starting_equity, 3),
            p95_outcome_multiple=round(result.final_equity_percentiles.get(95, starting_equity) / starting_equity, 3),
            probability_of_ruin=result.probability_of_ruin,
            coach_narrative=narrative,
            data_quality_notes=notes,
        )

    @staticmethod
    def _build_narrative(metrics, result, n: int) -> str:
        if metrics.expectancy_r >= 0.3:
            edge_read = "a real, measurable edge"
        elif metrics.expectancy_r > 0:
            edge_read = "an edge, though a modest one — worth tightening before scaling size"
        else:
            edge_read = "no measurable edge yet — this history doesn't support increasing risk"

        return (
            f"Across {n} trades, expectancy sits at {metrics.expectancy_r:+.2f}R with a "
            f"{metrics.win_rate*100:.0f}% win rate — that reads as {edge_read}. "
            f"Resampling this exact history forward thousands of times, the middle-of-the-road "
            f"outcome lands around {round(result.final_equity_percentiles.get(50, 0)):,}, with a "
            f"{result.probability_of_ruin}% chance of hitting the ruin threshold somewhere along "
            f"the way. This describes what your past trades imply statistically — it is not a "
            f"prediction of what your next trade does."
        )
