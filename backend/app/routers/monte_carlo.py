"""
Monte Carlo Router
===================

Exposes the Monte Carlo Predictive Performance Engine over HTTP so the
dashboard's Performance Forecast panel can call it.

Mount in main.py:

    from app.routers import monte_carlo
    app.include_router(monte_carlo.router, prefix="/api/monte-carlo", tags=["monte-carlo"])

Auth: gated on require_active_access, same as every other content
route — an Insights forecast is exactly the kind of paid feature that
should stop working the instant a duration pass lapses. Trade history
is scoped to the caller's own trades unless they're Admin/Super Admin
(STAFF_ROLES), matching trades.py/bots.py/dashboard.py's convention.
"""

from __future__ import annotations

from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access_gate import require_active_access, STAFF_ROLES
from app.db.repository import load_trade_history
from app.db.session import get_db
from app.engines.monte_carlo_engine import MonteCarloEngine, TradeRecord
from app.models.user import User

router = APIRouter()


def _scope_user_id(user: User) -> Optional[str]:
    return None if user.role in STAFF_ROLES else str(user.id)


# --------------------------------------------------------------------------
# Request / response models
# --------------------------------------------------------------------------

class SimulationRequest(BaseModel):
    trials: int = Field(default=2000, ge=100, le=20000)
    trades_per_trial: int = Field(default=100, ge=5, le=2000)
    starting_equity: float = Field(default=10000.0, gt=0)
    risk_mode: Literal["fixed_fractional", "fixed_dollar"] = "fixed_fractional"
    risk_value: float = Field(default=0.01, gt=0)
    resample_mode: Literal["iid", "block"] = "block"
    block_size: int = Field(default=5, ge=1, le=50)
    ruin_threshold_pct: float = Field(default=50.0, gt=0, le=100)
    target_equity: Optional[float] = None
    bot_id: Optional[str] = None
    seed: Optional[int] = None
    include_fan_chart: bool = True
    fan_chart_trials: int = Field(
        default=300, ge=50, le=1000,
        description="Separate (smaller) trial count used only for the "
                     "path-tracked fan chart, kept low to control payload size."
    )


class MetricsResponse(BaseModel):
    n_trades: int
    win_rate: float
    avg_win_r: float
    avg_loss_r: float
    expectancy_r: float
    std_dev_r: float
    max_win_streak: int
    max_loss_streak: int


class SimulationResponse(BaseModel):
    trials: int
    trades_per_trial: int
    starting_equity: float
    risk_mode: str
    risk_value: float
    final_equity_percentiles: dict
    max_drawdown_percentiles: dict
    probability_of_ruin: float
    probability_of_target: Optional[float]
    expectancy_r_used: float
    notes: List[str]
    fan_chart: Optional[List[dict]] = None
    metrics: MetricsResponse


# --------------------------------------------------------------------------
# Trade history source — REPLACE with your real query
# --------------------------------------------------------------------------

# --------------------------------------------------------------------------
# Trade history source — now backed by the real database (app/db/repository.py).
# If your schema differs from migrations/001_create_core_tables.sql, edit
# the query in load_trade_history() there — this router doesn't need to change.
# --------------------------------------------------------------------------


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------

@router.get("/metrics", response_model=MetricsResponse)
async def get_metrics(
    bot_id: Optional[str] = None, db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
):
    """Pattern/metric extraction from historical trades, no simulation."""
    history = await load_trade_history(db, bot_id, user_id=_scope_user_id(user))
    engine = MonteCarloEngine(history)
    try:
        m = engine.compute_metrics(bot_id=bot_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return MetricsResponse(**m.__dict__)


@router.post("/simulate", response_model=SimulationResponse)
async def simulate(
    req: SimulationRequest, db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
):
    """
    Runs the Monte Carlo simulation with the caller's parameters and
    returns the full distribution of outcomes for a future SET of trades,
    plus (optionally) a fan-chart-ready percentile-band series.
    """
    history = await load_trade_history(db, req.bot_id, user_id=_scope_user_id(user))
    engine = MonteCarloEngine(history)

    try:
        metrics = engine.compute_metrics(bot_id=req.bot_id)
        result = engine.run_simulation(
            trials=req.trials,
            trades_per_trial=req.trades_per_trial,
            starting_equity=req.starting_equity,
            risk_mode=req.risk_mode,
            risk_value=req.risk_value,
            resample_mode=req.resample_mode,
            block_size=req.block_size,
            ruin_threshold_pct=req.ruin_threshold_pct,
            target_equity=req.target_equity,
            bot_id=req.bot_id,
            seed=req.seed,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    fan_chart = None
    if req.include_fan_chart:
        paths = engine.simulate_equity_paths(
            trials=req.fan_chart_trials,
            trades_per_trial=req.trades_per_trial,
            starting_equity=req.starting_equity,
            risk_mode=req.risk_mode,
            risk_value=req.risk_value,
            resample_mode=req.resample_mode,
            block_size=req.block_size,
            bot_id=req.bot_id,
            seed=req.seed,
        )
        fan_chart = MonteCarloEngine.percentile_bands_over_time(paths)

    return SimulationResponse(
        trials=result.trials,
        trades_per_trial=result.trades_per_trial,
        starting_equity=result.starting_equity,
        risk_mode=result.risk_mode,
        risk_value=result.risk_value,
        final_equity_percentiles=result.final_equity_percentiles,
        max_drawdown_percentiles=result.max_drawdown_percentiles,
        probability_of_ruin=result.probability_of_ruin,
        probability_of_target=result.probability_of_target,
        expectancy_r_used=result.expectancy_r_used,
        notes=result.notes,
        fan_chart=fan_chart,
        metrics=MetricsResponse(**metrics.__dict__),
    )
