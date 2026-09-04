"""
Validation Gate Router
========================

Exposes the go-live validation gate over HTTP for the dashboard's
"Go-Live Checklist" panel.

Mount in main.py:

    from app.routers import validation_gate as validation_gate_router
    app.include_router(validation_gate_router.router, prefix="/api/validation-gate", tags=["validation-gate"])

TRADE DATA SOURCE: backtest results are written by save_backtest_trades()
whenever a real backtest runs (see engines/backtest_engine.py) — real,
distinct from monte_carlo.py's live-trade fix, since a backtest result
is a genuine standalone artifact, not something the live trades table
already contains.

Auth: gated on require_active_access, same as every other content route.
"""

from __future__ import annotations

from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access_gate import require_active_access
from app.models.user import User

from app.core.attestation_store import AttestationRecord
from app.db.repository import (
    get_latest_attestation, list_attestations_for_bot, load_backtest_trades,
    load_cost_stressed_trades, load_parameter_variant_trades, save_attestation,
)
from app.db.session import get_db
from app.engines.monte_carlo_engine import TradeRecord
from app.engines.validation_gate import REQUIRED_MANUAL_ATTESTATIONS, ValidationGate

router = APIRouter()

CheckName = Literal[
    "paper_trading_reconciliation", "kill_switch_test", "manual_emergency_close_test"
]


# --------------------------------------------------------------------------
# Request / response models
# --------------------------------------------------------------------------

class AttestRequest(BaseModel):
    bot_id: str
    check_name: CheckName
    passed: bool
    signed_by: str = Field(min_length=1)
    notes: str = ""


class AttestationResponse(BaseModel):
    bot_id: str
    check_name: str
    passed: bool
    signed_by: str
    signed_at: str
    notes: str

    @classmethod
    def from_record(cls, r: AttestationRecord) -> "AttestationResponse":
        return cls(
            bot_id=r.bot_id, check_name=r.check_name, passed=r.passed,
            signed_by=r.signed_by, signed_at=r.signed_at.isoformat(), notes=r.notes,
        )


class EvaluateRequest(BaseModel):
    bot_id: str
    min_trade_count: int = 50
    min_expectancy_r: float = 0.05
    max_acceptable_drawdown_pct: float = 30.0
    oos_split: float = 0.3
    cost_stress_max_expectancy_drop_pct: float = 50.0
    parameter_stability_max_variance_r: float = 0.25
    include_cost_stress: bool = True
    include_parameter_stability: bool = True


class CheckResultResponse(BaseModel):
    name: str
    status: Literal["pass", "fail", "missing"]
    automated: bool
    detail: str
    attestation: Optional[AttestationResponse] = None


class GateEvaluateResponse(BaseModel):
    bot_id: str
    overall_pass: bool
    blocking_failures: List[str]
    checks: List[CheckResultResponse]


# --------------------------------------------------------------------------
# Trade data sources — REPLACE with real backtest result queries
# --------------------------------------------------------------------------

# --------------------------------------------------------------------------
# Trade data — now backed by the real database. All three functions read
# from the closed_trades table, filtered by `source` (see the migration).
# If a bot has no cost-stress or parameter-variant backtest on file yet,
# these correctly return None so the gate reports that check as "missing"
# rather than silently passing it.
# --------------------------------------------------------------------------


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------

@router.post("/attest", response_model=AttestationResponse)
async def submit_attestation(
    req: AttestRequest, db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
):
    """Records a human sign-off (or explicit failure) for one of the three
    manual safety checks. Append-only — submitting again creates a new
    record and supersedes the previous one for gate purposes, but full
    history is preserved and readable via /attestations/{bot_id}."""
    record = AttestationRecord(
        bot_id=req.bot_id, check_name=req.check_name, passed=req.passed,
        signed_by=req.signed_by, notes=req.notes,
    )
    await save_attestation(db, record)
    return AttestationResponse.from_record(record)


@router.get("/attestations/{bot_id}", response_model=List[AttestationResponse])
async def get_attestations(
    bot_id: str, db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
):
    """Full attestation history for a bot, oldest first — the audit trail."""
    records = await list_attestations_for_bot(db, bot_id)
    return [AttestationResponse.from_record(r) for r in records]


@router.post("/evaluate", response_model=GateEvaluateResponse)
async def evaluate_gate(
    req: EvaluateRequest, db: AsyncSession = Depends(get_db),
    user: User = Depends(require_active_access),
):
    """Runs the full go-live validation gate for one bot: automated checks
    against stored backtest results, plus the latest manual attestations
    on file. Missing manual attestations correctly block go-live."""
    trades = await load_backtest_trades(db, req.bot_id)

    gate = ValidationGate(
        min_trade_count=req.min_trade_count,
        min_expectancy_r=req.min_expectancy_r,
        max_acceptable_drawdown_pct=req.max_acceptable_drawdown_pct,
        oos_split=req.oos_split,
        cost_stress_max_expectancy_drop_pct=req.cost_stress_max_expectancy_drop_pct,
        parameter_stability_max_variance_r=req.parameter_stability_max_variance_r,
    )

    manual_attestations: Dict[str, bool] = {}
    attestation_by_check: Dict[str, AttestationRecord] = {}
    for check_name in REQUIRED_MANUAL_ATTESTATIONS:
        record = await get_latest_attestation(db, req.bot_id, check_name)
        if record is not None:
            manual_attestations[check_name] = record.passed
            attestation_by_check[check_name] = record

    cost_stressed = (await load_cost_stressed_trades(db, req.bot_id)) if req.include_cost_stress else None
    param_variants = (await load_parameter_variant_trades(db, req.bot_id)) if req.include_parameter_stability else None

    try:
        report = gate.evaluate(
            trades=trades,
            cost_stressed_trades=cost_stressed,
            parameter_variant_trade_sets=param_variants,
            manual_attestations=manual_attestations,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    checks_out: List[CheckResultResponse] = []
    for c in report.checks:
        status = "pass" if c.passed is True else "fail" if c.passed is False else "missing"
        record = attestation_by_check.get(c.name)
        checks_out.append(CheckResultResponse(
            name=c.name, status=status, automated=c.automated, detail=c.detail,
            attestation=AttestationResponse.from_record(record) if record else None,
        ))

    return GateEvaluateResponse(
        bot_id=req.bot_id,
        overall_pass=report.overall_pass,
        blocking_failures=report.blocking_failures,
        checks=checks_out,
    )
