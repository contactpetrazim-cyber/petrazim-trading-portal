"""
Chart Layout Router — implements TradingView's Save/Load contract shape
============================================================================

Endpoint names and response shapes deliberately mirror what TradingView's
Advanced Charts Library's save_load_adapter expects, so this backend
can be wired in directly as the library's saveLoadAdapter implementation
later, without changing the contract. Works standalone today too — any
frontend can call these directly to save/load a user's chart state.
"""

from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access_gate import require_active_access
from app.database import get_db
from app.models.chart_layout import ChartDrawingTemplate, ChartLayout
from app.models.user import User

router = APIRouter(prefix="/tradingview/charts", tags=["tradingview-charts"])


class SaveLayoutRequest(BaseModel):
    name: str
    symbol: Optional[str] = None
    content: str


class LayoutSummary(BaseModel):
    id: str
    name: str
    symbol: Optional[str]
    updated_at: str


class LayoutDetail(LayoutSummary):
    content: str


@router.get("/layouts", response_model=List[LayoutSummary])
async def list_layouts(db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)):
    rows = (await db.execute(
        select(ChartLayout).where(ChartLayout.user_id == user.id).order_by(ChartLayout.updated_at.desc())
    )).scalars().all()
    return [
        LayoutSummary(id=str(r.id), name=r.name, symbol=r.symbol, updated_at=r.updated_at.isoformat())
        for r in rows
    ]


@router.get("/layouts/{layout_id}", response_model=LayoutDetail)
async def get_layout(layout_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)):
    row = (await db.execute(
        select(ChartLayout).where(ChartLayout.id == layout_id, ChartLayout.user_id == user.id)
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Layout not found")
    return LayoutDetail(
        id=str(row.id), name=row.name, symbol=row.symbol,
        updated_at=row.updated_at.isoformat(), content=row.content,
    )


@router.post("/layouts", response_model=LayoutSummary)
async def save_layout(
    req: SaveLayoutRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)
):
    existing = (await db.execute(
        select(ChartLayout).where(ChartLayout.user_id == user.id, ChartLayout.name == req.name)
    )).scalar_one_or_none()

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)

    if existing:
        existing.content = req.content
        existing.symbol = req.symbol
        existing.updated_at = now
        row = existing
    else:
        row = ChartLayout(user_id=user.id, name=req.name, symbol=req.symbol, content=req.content,
                           created_at=now, updated_at=now)
        db.add(row)

    await db.commit()
    await db.refresh(row)
    return LayoutSummary(id=str(row.id), name=row.name, symbol=row.symbol, updated_at=row.updated_at.isoformat())


@router.delete("/layouts/{layout_id}")
async def delete_layout(layout_id: str, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)):
    row = (await db.execute(
        select(ChartLayout).where(ChartLayout.id == layout_id, ChartLayout.user_id == user.id)
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Layout not found")
    await db.delete(row)
    await db.commit()
    return {"ok": True}


class SaveTemplateRequest(BaseModel):
    name: str
    tool_name: str
    content: str


class TemplateSummary(BaseModel):
    id: str
    name: str
    tool_name: str


@router.get("/drawing-templates", response_model=List[TemplateSummary])
async def list_templates(db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)):
    rows = (await db.execute(
        select(ChartDrawingTemplate).where(ChartDrawingTemplate.user_id == user.id)
    )).scalars().all()
    return [TemplateSummary(id=str(r.id), name=r.name, tool_name=r.tool_name) for r in rows]


@router.post("/drawing-templates", response_model=TemplateSummary)
async def save_template(
    req: SaveTemplateRequest, db: AsyncSession = Depends(get_db), user: User = Depends(require_active_access)
):
    row = ChartDrawingTemplate(user_id=user.id, name=req.name, tool_name=req.tool_name, content=req.content)
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return TemplateSummary(id=str(row.id), name=row.name, tool_name=row.tool_name)
