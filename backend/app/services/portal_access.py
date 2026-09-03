"""
Portal Access Engine — strictly downward, no exceptions
============================================================

After login, a user with access to more than one portal sees a
selection screen (their own portal, plus anything below it in the
hierarchy). A role can NEVER select a portal above its own — this is
enforced here as pure logic (testable without a server) and then
re-checked server-side on every portal-scoped request via
require_portal_access(), so a client-side selection screen is a
convenience, never the actual security boundary.

HIERARCHY (fixed, not configurable per-request):
  super_admin  -> can view: admin, fund_manager, partner, trader
  admin        -> can view: admin, fund_manager, partner, trader
  fund_manager -> can view: fund_manager, trader
  partner      -> can view: partner, trader
  trader       -> can view: trader only

fund_manager and partner are treated as PARALLEL specialist roles, not
stacked on top of each other — a Fund Manager has no business reason
to view a Partner's console or vice versa. Both can drop down to the
Trader view (e.g. to see exactly what their traders see), but neither
can reach the other's console or Admin's.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

PORTAL_ACCESS: Dict[str, List[str]] = {
    "super_admin": ["admin", "fund_manager", "partner", "trader"],
    "admin": ["admin", "fund_manager", "partner", "trader"],
    "fund_manager": ["fund_manager", "trader"],
    "partner": ["partner", "trader"],
    "trader": ["trader"],
}

PORTAL_LABELS = {
    "trader": "Trader Dashboard",
    "fund_manager": "Fund Manager Console",
    "partner": "Partner Console",
    "admin": "Admin Console",
}

PORTAL_LANDING_ROUTE = {
    "trader": "/dashboard",
    "fund_manager": "/manager",
    "partner": "/partner",
    "admin": "/admin",
}


def get_available_portals(role: str) -> List[str]:
    if role not in PORTAL_ACCESS:
        raise ValueError(f"Unknown role: {role}")
    return PORTAL_ACCESS[role]


@dataclass
class PortalAccessCheck:
    allowed: bool
    reason: str = ""


def check_portal_access(role: str, requested_portal: str) -> PortalAccessCheck:
    """The actual security check — call this server-side on every
    portal-scoped request, never trust a client-sent 'I selected portal
    X' claim without re-verifying it against the role on the verified
    JWT."""
    if role not in PORTAL_ACCESS:
        return PortalAccessCheck(allowed=False, reason=f"Unknown role: {role}")
    if requested_portal not in PORTAL_ACCESS[role]:
        return PortalAccessCheck(
            allowed=False,
            reason=f"Role '{role}' does not have access to the '{requested_portal}' portal.",
        )
    return PortalAccessCheck(allowed=True)


def needs_portal_selection(role: str) -> bool:
    """True when a role has more than one portal available — this is
    what decides whether to show the selection screen after login at
    all, vs. sending a Trader (who only ever has one option) straight
    to their dashboard with no extra screen in the way."""
    return len(get_available_portals(role)) > 1
