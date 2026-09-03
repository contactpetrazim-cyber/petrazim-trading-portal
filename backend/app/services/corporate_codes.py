"""
Corporate Seat Codes
======================

Answers the question directly: a corporate purchase of N seats
generates N distinct, single-use codes — not one shared code redeemed
N times. Each sponsored individual gets their OWN code, redeems it
through the same single "Promo or Code Access" field every other code
type uses, and gets their own individual account access. The
purchasing org never sees or controls what the individual does with
their access once redeemed — the code is the only link between them.

WHY N DISTINCT CODES, NOT ONE SHARED CODE WITH max_redemptions=N:
A shared code is simpler to generate but harder to administer — the
purchaser can't tell who's redeemed and who hasn't (all uses look
identical), can't revoke one person's access without killing everyone
else's, and if the code leaks, every remaining seat is exposed at
once. Individual codes solve all three: redemption is traceable to
which seat, one seat can be handled independently, and a leaked code
only exposes one seat.

VALIDITY: 60 days from generation, per your specification — same
pattern proven in the Academy build.
"""

from __future__ import annotations

import secrets
import string
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Set

from app.models.access import AccessCode, AccessTier, CodeType

SEAT_CODE_VALIDITY_DAYS = 60
CODE_ALPHABET = "".join(c for c in string.ascii_uppercase + string.digits if c not in "0O1IL")


def _generate_readable_code(segment_length: int = 4, segments: int = 2) -> str:
    """e.g. 'PZM-K7X4-9QRT' — readable, no ambiguous characters (no 0/O, 1/I/L mixups)."""
    parts = ["".join(secrets.choice(CODE_ALPHABET) for _ in range(segment_length)) for _ in range(segments)]
    return "PZM-" + "-".join(parts)


@dataclass
class GeneratedSeatBatch:
    codes: List[str]
    tier: str
    seat_count: int
    expires_at: datetime
    issued_by_user_id: str


def generate_seat_codes(
    issued_by_user_id: str, tier: AccessTier, seat_count: int,
    validity_days: int = SEAT_CODE_VALIDITY_DAYS, existing_codes: Optional[Set[str]] = None,
) -> GeneratedSeatBatch:
    """Pure generation logic — returns the codes and their shared expiry;
    caller (the router) is responsible for persisting each as its own
    AccessCode row. `existing_codes` lets the caller pass in currently-
    used codes to guarantee no collision without a DB round-trip per
    candidate — the router should still verify uniqueness against the
    DB before insert as a final guard, this is a fast-path collision
    check, not the only one."""
    if seat_count < 1:
        raise ValueError("seat_count must be at least 1")
    if seat_count > 500:
        raise ValueError("Single-batch seat purchases over 500 need manual review — contact support")

    existing = set(existing_codes or [])
    codes: List[str] = []

    while len(codes) < seat_count:
        candidate = _generate_readable_code()
        if candidate not in existing and candidate not in codes:
            codes.append(candidate)

    expires_at = datetime.now(timezone.utc) + timedelta(days=validity_days)

    return GeneratedSeatBatch(
        codes=codes, tier=tier.value, seat_count=seat_count,
        expires_at=expires_at, issued_by_user_id=issued_by_user_id,
    )


def build_access_code_rows(batch: GeneratedSeatBatch, tier: AccessTier) -> List[AccessCode]:
    """Converts a generated batch into ORM rows ready for db.add_all().
    Each row is single-use (max_redemptions=1) — this is what makes them
    individual seats rather than one shared code."""
    return [
        AccessCode(
            code=code, code_type=CodeType.CORPORATE_SEAT, tier_granted=tier,
            duration_hours=24 * 30,   # the SEAT's post-redemption access window (30 days) —
                                       # distinct from the 60-day window the CODE ITSELF stays
                                       # redeemable before it expires unused
            issued_by_user_id=batch.issued_by_user_id,
            max_redemptions=1, redemption_count=0,
            expires_at=batch.expires_at,
        )
        for code in batch.codes
    ]
