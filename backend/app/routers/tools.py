"""
Tools Router — the API layer none of the 5 Tools engines had
=================================================================

Master Handover Part A §6 calls Tools "the most completely BUILT-AND-
TESTED area of the whole product," but every one of its 5 engines
(risk_of_ruin_calculator.py, prop_firm_simulator.py, correlation_engine.py,
journal_reviewer.py, payout_optimizer.py) was pure Python with zero HTTP
surface — nothing in routers/ ever imported any of them. This is that
surface, one endpoint per engine, using each engine's own real
input/output shapes rather than inventing new ones.

Auth: Risk-of-Ruin is deliberately left OPEN, no login required — its
own docstring calls it "Explore Concept #2 (free lead magnet)," and a
lead magnet that requires an active paid pass first isn't one. The
other four are gated on require_active_access like every other Tools/
Insights route.
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access_gate import require_active_access, STAFF_ROLES
from app.database import get_db
from app.db.repository import load_trade_history
from app.engines.correlation_engine import CorrelationEngine, ReturnSeries
from app.engines.journal_reviewer import JournalReviewerEngine, ManualJournalEntry
from app.engines.monte_carlo_engine import TradeRecord
from app.engines.payout_optimizer import FundedAccount, PayoutOptimizer
from app.engines.prop_firm_simulator import PROP_FIRM_PRESETS, PropFirmChallengeSimulator
from app.engines.risk_of_ruin_calculator import RiskOfRuinCalculator, RiskOfRuinInput
from app.models.user import User

router = APIRouter(prefix="/tools", tags=["tools"])


# --------------------------------------------------------------------------
# Risk-of-Ruin — open, no auth
# --------------------------------------------------------------------------

class RiskOfRuinRequest(BaseModel):
    win_rate: float = Field(gt=0, lt=1)
    avg_win_r: float = Field(gt=0)
    avg_loss_r: float = Field(gt=0)
    risk_per_trade_pct: float = Field(gt=0)
    num_trades: int = 100
    ruin_threshold_pct: float = 50.0
    trials: int = 5000


@router.post("/risk-of-ruin")
async def risk_of_ruin(req: RiskOfRuinRequest):
    try:
        result = RiskOfRuinCalculator().calculate(RiskOfRuinInput(**req.model_dump()))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result.__dict__


# --------------------------------------------------------------------------
# Prop-Firm Challenge Simulator
# --------------------------------------------------------------------------

class PropFirmRequest(BaseModel):
    preset: str = "generic_10_5_10"
    r_multiples: Optional[List[float]] = None   # omit to use the caller's own real closed trades
    trials: int = 2000
    risk_per_trade_pct: float = 1.0
    max_days: int = 60
    seed: Optional[int] = None


@router.get("/prop-firm/presets")
async def prop_firm_presets():
    return {key: rules.__dict__ for key, rules in PROP_FIRM_PRESETS.items()}


@router.post("/prop-firm")
async def prop_firm(
    req: PropFirmRequest, db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
):
    if req.preset not in PROP_FIRM_PRESETS:
        raise HTTPException(status_code=400, detail=f"Unknown preset '{req.preset}'")

    if req.r_multiples is not None:
        r_multiples = req.r_multiples
    else:
        user_id = None if user.role in STAFF_ROLES else str(user.id)
        history = await load_trade_history(db, user_id=user_id)
        r_multiples = [t.r_multiple for t in history]

    try:
        sim = PropFirmChallengeSimulator([
            TradeRecord(trade_id=f"r{i}", r_multiple=r) for i, r in enumerate(r_multiples)
        ])
        result = sim.simulate(
            PROP_FIRM_PRESETS[req.preset], trials=req.trials,
            risk_per_trade_pct=req.risk_per_trade_pct, max_days=req.max_days, seed=req.seed,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return result.__dict__


# --------------------------------------------------------------------------
# Correlation Heat Map
# --------------------------------------------------------------------------

class SeriesInput(BaseModel):
    label: str
    returns: List[float]


class CorrelationRequest(BaseModel):
    series: List[SeriesInput]
    high_threshold: float = 0.7
    moderate_threshold: float = 0.5


@router.post("/correlation")
async def correlation(req: CorrelationRequest, user: User = Depends(require_active_access)):
    engine = CorrelationEngine(high_threshold=req.high_threshold, moderate_threshold=req.moderate_threshold)
    try:
        report = engine.compute([ReturnSeries(label=s.label, returns=s.returns) for s in req.series])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "labels": report.labels, "matrix": report.matrix,
        "flags": [f.__dict__ for f in report.flags],
    }


# --------------------------------------------------------------------------
# AI Trade Journal Reviewer
# --------------------------------------------------------------------------

class JournalEntryInput(BaseModel):
    trade_id: str
    symbol: str
    direction: str
    entry_price: float
    exit_price: float
    stop_price: float
    entry_time: str
    exit_time: str
    exit_reason: str
    trader_notes: str = ""
    screenshot_url: Optional[str] = None
    psychology_tag: Optional[str] = None


class JournalReviewRequest(BaseModel):
    entries: List[JournalEntryInput]


@router.post("/journal-reviewer")
async def journal_reviewer(req: JournalReviewRequest, user: User = Depends(require_active_access)):
    from datetime import datetime

    try:
        entries = [
            ManualJournalEntry(
                trade_id=e.trade_id, symbol=e.symbol, direction=e.direction,
                entry_price=e.entry_price, exit_price=e.exit_price, stop_price=e.stop_price,
                entry_time=datetime.fromisoformat(e.entry_time), exit_time=datetime.fromisoformat(e.exit_time),
                exit_reason=e.exit_reason, trader_notes=e.trader_notes,
                screenshot_url=e.screenshot_url, psychology_tag=e.psychology_tag,
            )
            for e in req.entries
        ]
        summary = JournalReviewerEngine().review(entries)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return summary.__dict__


# --------------------------------------------------------------------------
# Funded-Account Payout Optimizer
# --------------------------------------------------------------------------

class FundedAccountInput(BaseModel):
    account_id: str
    firm_name: str
    balance: float
    daily_loss_limit_pct: float
    total_drawdown_limit_pct: float
    current_daily_loss_pct: float
    current_total_drawdown_pct: float
    payout_eligible: bool = True


class PayoutOptimizeRequest(BaseModel):
    accounts: List[FundedAccountInput]
    safety_margin_pct: float = 20.0
    max_risk_per_trade_pct: float = 1.0


@router.post("/payout-optimizer")
async def payout_optimizer(req: PayoutOptimizeRequest, user: User = Depends(require_active_access)):
    optimizer = PayoutOptimizer(
        safety_margin_pct=req.safety_margin_pct, max_risk_per_trade_pct=req.max_risk_per_trade_pct,
    )
    try:
        report = optimizer.optimize([FundedAccount(**a.model_dump()) for a in req.accounts])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "allocations": [a.__dict__ for a in report.allocations],
        "total_accounts": report.total_accounts, "accounts_allocated": report.accounts_allocated,
        "accounts_excluded": report.accounts_excluded, "notes": report.notes,
    }
