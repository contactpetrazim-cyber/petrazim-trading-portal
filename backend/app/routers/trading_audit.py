"""
Monthly Trading Audit — API
================================

Backs the Admin portal's "Monthly Trading Audit" page: list past runs,
trigger a new one on demand, view a run's full report, and apply/
dismiss individual recommendations. See engines/trading_audit_engine.py
for what a run actually computes and why "apply" is scoped as
narrowly as it is.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_role, require_super_admin
from app.database import get_db
from app.engines.trading_audit_engine import apply_recommendation, run_audit
from app.models.trading_audit import TradingAuditFinding, TradingAuditRun
from app.models.user import User, UserRole
from app.config import get_settings

router = APIRouter(prefix="/admin/trading-audit", tags=["trading-audit"])


class FindingResponse(BaseModel):
    id: str
    category: str
    evidence_level: str
    severity: str
    title: str
    detail: str
    bot_id: Optional[str] = None
    recommended_action: Optional[str] = None
    recommendation_status: str
    applied_at: Optional[datetime] = None
    applied_by: Optional[str] = None


class RunSummaryResponse(BaseModel):
    id: str
    period_start: datetime
    period_end: datetime
    status: str
    triggered_by: str
    generated_at: datetime
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None


class RunDetailResponse(RunSummaryResponse):
    summary: dict
    findings: List[FindingResponse]
    report_markdown: Optional[str] = None


def _finding_to_response(f: TradingAuditFinding) -> FindingResponse:
    return FindingResponse(
        id=str(f.id), category=f.category, evidence_level=f.evidence_level,
        severity=f.severity.value, title=f.title, detail=f.detail, bot_id=f.bot_id,
        recommended_action=f.recommended_action, recommendation_status=f.recommendation_status.value,
        applied_at=f.applied_at, applied_by=f.applied_by,
    )


@router.get("/runs", response_model=List[RunSummaryResponse])
async def list_runs(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    runs = (await db.execute(select(TradingAuditRun).order_by(TradingAuditRun.generated_at.desc()).limit(50))).scalars().all()
    return [
        RunSummaryResponse(
            id=str(r.id), period_start=r.period_start, period_end=r.period_end,
            status=r.status.value, triggered_by=r.triggered_by, generated_at=r.generated_at,
            completed_at=r.completed_at, error_message=r.error_message,
        )
        for r in runs
    ]


@router.get("/runs/{run_id}", response_model=RunDetailResponse)
async def get_run(
    run_id: str, db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    run = (await db.execute(select(TradingAuditRun).where(TradingAuditRun.id == run_id))).scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=404, detail="Audit run not found")
    findings = (await db.execute(
        select(TradingAuditFinding).where(TradingAuditFinding.run_id == run_id).order_by(TradingAuditFinding.severity.desc())
    )).scalars().all()
    return RunDetailResponse(
        id=str(run.id), period_start=run.period_start, period_end=run.period_end,
        status=run.status.value, triggered_by=run.triggered_by, generated_at=run.generated_at,
        completed_at=run.completed_at, error_message=run.error_message,
        summary=json.loads(run.summary_json or "{}"),
        findings=[_finding_to_response(f) for f in findings],
        report_markdown=run.report_markdown,
    )


@router.post("/run", response_model=RunSummaryResponse)
async def trigger_run(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    """Manual "Run Now" — same code path the monthly scheduled worker
    uses, with the same configured lookback window."""
    settings = get_settings()
    period_end = datetime.utcnow()
    period_start = period_end - timedelta(days=settings.TRADING_AUDIT_LOOKBACK_DAYS)
    run = await run_audit(db, period_start, period_end, triggered_by="manual")
    return RunSummaryResponse(
        id=str(run.id), period_start=run.period_start, period_end=run.period_end,
        status=run.status.value, triggered_by=run.triggered_by, generated_at=run.generated_at,
        completed_at=run.completed_at, error_message=run.error_message,
    )


@router.delete("/runs/{run_id}", response_model=dict)
async def delete_run(
    run_id: str, db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    """Deletes one past audit run (and its findings) from the list — by
    direct request ("provide option to delete items"). Not live-
    trading-affecting (a stored report, nothing more), so same
    ADMIN/SUPER_ADMIN gate as the rest of this read/manage surface,
    not the stricter require_super_admin apply_finding uses for
    actions that mutate a live bot. Findings have no ON DELETE CASCADE
    on their run_id FK, so they're deleted explicitly first — same
    transaction, so a failure here leaves nothing orphaned either way."""
    run = (await db.execute(select(TradingAuditRun).where(TradingAuditRun.id == run_id))).scalar_one_or_none()
    if run is None:
        raise HTTPException(status_code=404, detail="Audit run not found")
    findings = (await db.execute(select(TradingAuditFinding).where(TradingAuditFinding.run_id == run_id))).scalars().all()
    for f in findings:
        await db.delete(f)
    await db.delete(run)
    await db.commit()
    return {"success": True}


@router.post("/findings/{finding_id}/apply", response_model=dict)
async def apply_finding(
    finding_id: str, db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_super_admin),
):
    """Risk-mutating — same require_super_admin gate as every other
    live-trading-affecting Admin action (bots.py's master balance/
    leverage/scanner-mode endpoints)."""
    finding = (await db.execute(select(TradingAuditFinding).where(TradingAuditFinding.id == finding_id))).scalar_one_or_none()
    if finding is None:
        raise HTTPException(status_code=404, detail="Finding not found")
    result = await apply_recommendation(db, finding, applied_by=admin.email)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@router.post("/findings/{finding_id}/dismiss", response_model=dict)
async def dismiss_finding(
    finding_id: str, db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(UserRole.ADMIN, UserRole.SUPER_ADMIN)),
):
    finding = (await db.execute(select(TradingAuditFinding).where(TradingAuditFinding.id == finding_id))).scalar_one_or_none()
    if finding is None:
        raise HTTPException(status_code=404, detail="Finding not found")
    from app.models.trading_audit import AuditRecommendationStatus
    finding.recommendation_status = AuditRecommendationStatus.DISMISSED
    finding.dismissed_at = datetime.utcnow()
    await db.commit()
    return {"success": True}
