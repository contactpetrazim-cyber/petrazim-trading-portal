"""
Attestation Store
==================

Backs the three manual, safety-critical checks in the validation gate
(paper-trading reconciliation, kill-switch test, manual emergency-close
test). Unlike everything else in this build so far, these records are
an audit trail — WHO signed off, WHEN, and any notes — not just a
boolean. "Someone clicked a checkbox" isn't good enough for a check
that exists specifically because code can't verify it; a name and a
timestamp make it a real attestation.

Swap InMemoryAttestationStore for a DB-backed one before going live —
in-memory records vanish on restart, which defeats the point of an
audit trail. Keep the same three methods and nothing else needs to change.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple


@dataclass
class AttestationRecord:
    bot_id: str
    check_name: str            # one of REQUIRED_MANUAL_ATTESTATIONS
    passed: bool
    signed_by: str
    signed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    notes: str = ""


class InMemoryAttestationStore:
    """Dev use only — records are lost on restart. Replace with a real
    table (bot_id, check_name, passed, signed_by, signed_at, notes) before
    this gate is used to authorize real autonomous trading."""

    def __init__(self):
        self._records: Dict[Tuple[str, str], List[AttestationRecord]] = {}

    def save(self, record: AttestationRecord) -> AttestationRecord:
        key = (record.bot_id, record.check_name)
        self._records.setdefault(key, []).append(record)
        return record

    def get_latest(self, bot_id: str, check_name: str) -> Optional[AttestationRecord]:
        records = self._records.get((bot_id, check_name), [])
        return records[-1] if records else None

    def list_for_bot(self, bot_id: str) -> List[AttestationRecord]:
        out: List[AttestationRecord] = []
        for (b, _), records in self._records.items():
            if b == bot_id:
                out.extend(records)
        return sorted(out, key=lambda r: r.signed_at)


# Module-level singleton for the in-memory dev store. Replace this whole
# pattern with a proper DB session dependency when you wire in real storage.
default_store = InMemoryAttestationStore()
