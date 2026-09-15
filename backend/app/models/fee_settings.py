"""
Performance Fee Settings — a platform-wide Fee/Free toggle and, when
on, a percentage the platform takes off the PROFIT (never the loss)
of a subscriber's copy trade — by direct request ("introduce a fee
base or a share of the profit - on a success basis... Create a fee vs
free toggle... include in Admin portal... include the form for Admin
to enter Account to receive the benefit... Crypto address and/or bank
account - Paystack?").

Honest scope: this is a FEE CALCULATION + DISCLOSURE system, not an
automatic payment-collection one. This platform never holds a
trader's exchange funds (their API key explicitly has withdrawals
DISABLED, by this same onboarding flow's own instructions — see
services/trader_broker_connections.py's EXCHANGE_META), so there is no
way to actually deduct a fee from their exchange balance
automatically. What this genuinely does: every time a subscriber's
copy trade closes at a profit, the exact fee owed is computed and
recorded (services/performance_fees.py's own apply_performance_fee) —
visible to both the trader (what they owe) and the admin (who owes
what, and where to collect it, via the payout fields below). Actually
COLLECTING it — a crypto transfer the trader sends, or a Paystack
charge/transfer an admin initiates outside this app — happens outside
this codebase; an admin marks a ledger entry PAID once that's
confirmed (routers/fees.py's own admin_mark_paid), the same honest
"real record, not a fake automated payment" pattern as this app's
other stubbed-provider features (see services/email.py's own
docstring for the same shape of honesty).
"""

from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class PayoutMethod(enum.Enum):
    CRYPTO = "crypto"
    PAYSTACK = "paystack"
    BOTH = "both"


class PlatformFeeSettings(Base):
    """A single-row (id=1) table — one platform-wide fee configuration,
    not per-trader or per-bot, matching the "fee vs free toggle"
    request as one switch an Admin controls. Read via
    services/performance_fees.py's own get_fee_settings, which creates
    this row with safe (fee OFF, 0%) defaults the first time it's
    read, so a fresh deployment never charges anything until an Admin
    explicitly turns it on."""
    __tablename__ = "platform_fee_settings"

    id = Column(String(10), primary_key=True, default="singleton")

    enabled = Column(Boolean, nullable=False, default=False)
    # Percent of PROFIT (only ever applied when a copy trade's own
    # realized P&L on that close is positive — see
    # apply_performance_fee's own "success basis" comment).
    fee_percent = Column(Float, nullable=False, default=0.0)

    payout_method = Column(Enum(PayoutMethod), nullable=False, default=PayoutMethod.CRYPTO)

    # What currency fee_amount figures (and, by extension, the real
    # Paystack checkout in routers/fees.py's own start_fee_checkout)
    # are denominated in. Not assumed NGN like the Academy's own
    # catalogue (models/access.py) — a copy trade's realized P&L comes
    # from a crypto/forex broker and is typically USD, so this is an
    # explicit Admin-set field rather than a hardcoded currency that
    # would silently mismatch what a trader's P&L actually is in.
    settlement_currency = Column(String(3), nullable=False, default="USD")

    # Not secrets — a receive-only crypto address or bank account
    # number can't be used to move money OUT on its own, unlike an
    # exchange API key, so these are plain columns, not Fernet-
    # encrypted like TraderBrokerConnection's credentials.
    crypto_address = Column(String(200), nullable=True)
    crypto_network = Column(String(50), nullable=True)  # e.g. "USDT (TRC20)", "BTC", "ETH (ERC20)" — free text

    paystack_account_name = Column(String(150), nullable=True)
    paystack_account_number = Column(String(30), nullable=True)
    paystack_bank_name = Column(String(100), nullable=True)
    paystack_bank_code = Column(String(20), nullable=True)
    # Populated only if an admin later wires the real Paystack API
    # (creating a Paystack Subaccount/Recipient) — this app makes no
    # live Paystack API call anywhere today; these fields are the
    # destination record for a manual/administrative transfer until
    # that integration exists.
    paystack_recipient_code = Column(String(100), nullable=True)

    notes = Column(Text, nullable=True)  # free-text, e.g. "wire only above $50"

    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class FeeLedgerStatus(enum.Enum):
    OWED = "owed"
    PAID = "paid"
    WAIVED = "waived"


class PerformanceFeeLedgerEntry(Base):
    """One row per fee accrued on one profitable copy-trade close — the
    real, queryable "who owes what" record. Created by
    services/performance_fees.py's own apply_performance_fee
    immediately when a subscriber's copy trade closes in profit while
    fees are enabled; never created for a loss, a platform-owned
    trade, or a trader's own manual trade (see Trade.subscription_id's
    own comment for what makes a trade fee-eligible at all)."""
    __tablename__ = "performance_fee_ledger"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    trade_id = Column(String(50), ForeignKey("trades.trade_id"), nullable=False, index=True)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("trader_bot_subscriptions.id"), nullable=True)

    pnl_amount = Column(Float, nullable=False)  # this close's own realized profit the fee was computed from
    fee_percent_applied = Column(Float, nullable=False)  # snapshot — a later settings change never rewrites history
    fee_amount = Column(Float, nullable=False)

    status = Column(Enum(FeeLedgerStatus), nullable=False, default=FeeLedgerStatus.OWED)
    paid_at = Column(DateTime, nullable=True)
    paid_note = Column(Text, nullable=True)  # admin's own record of how/when it was actually settled
    marked_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
