"""
Available Portals Endpoint
==============================

Separate small router so it can be added to app/main.py alongside the
existing auth router without editing that file's internals — mount
this at the same /auth prefix.
"""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.auth import get_current_user
from app.models.user import User
from app.services.portal_access import (
    PORTAL_LABELS, PORTAL_LANDING_ROUTE, get_available_portals, needs_portal_selection,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class PortalOption(BaseModel):
    id: str
    label: str
    route: str


class AvailablePortalsResponse(BaseModel):
    portals: List[PortalOption]
    needs_selection: bool
    default_route: str


@router.get("/available-portals", response_model=AvailablePortalsResponse)
async def available_portals(user: User = Depends(get_current_user)):
    role = user.role.value
    portal_ids = get_available_portals(role)

    return AvailablePortalsResponse(
        portals=[
            PortalOption(id=p, label=PORTAL_LABELS[p], route=PORTAL_LANDING_ROUTE[p])
            for p in portal_ids
        ],
        needs_selection=needs_portal_selection(role),
        default_route=PORTAL_LANDING_ROUTE[portal_ids[0]],
    )
