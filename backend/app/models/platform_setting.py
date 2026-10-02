"""A small generic key/value settings table for platform-wide toggles
that need to change at runtime without a redeploy — the first use was
payments.mode (test/live); trading.paper_enforced (below) is the
second, since flipping between test/live processing is exactly the
kind of decision that shouldn't require editing a Render env var and
waiting for a rebuild.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Column, DateTime, String

from app.database import Base


class PlatformSetting(Base):
    __tablename__ = "platform_settings"

    key = Column(String(100), primary_key=True)
    value = Column(String(500), nullable=False)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


PAYMENTS_MODE_KEY = "payments.mode"

# Super Admin's platform-wide trading kill-switch — by direct request
# ("a master control in the super Admin portal"). "true" forces every
# manual order into Paper Trading regardless of what an individual
# trader's own Test/Live or Paper Trading toggle says — see
# routers/manual_trading.py::place_manual_order's own `paper`
# computation. Defaults to unset/"false" (no override) the same
# fail-safe-not-fail-open way PAYMENTS_MODE_KEY defaults to "test".
TRADING_PAPER_ENFORCED_KEY = "trading.paper_enforced"

# Super Admin's platform-wide Fireflies notetaker switch — by direct
# request ("put a Fireflies toggle on vs off in the portals follow
# hierarchy"), replacing an earlier per-booking checkbox that let each
# trainee opt out individually. One control point, same "Admin sets
# it, every portal beneath inherits the same resolved state" pattern
# as TRADING_PAPER_ENFORCED_KEY's own master control — a Fund
# Manager/Partner/Trader session can't diverge from what Admin set.
# Defaults to unset/"true" when no row exists — Fireflies being
# invited to every session was the original, unmodified behavior
# before this switch existed, so an absent row preserves that rather
# than silently going quiet.
FIREFLIES_ENABLED_KEY = "fireflies.enabled"

# Admin runtime on/off for the autonomous market scanner (see
# services/market_scanner.py) — by direct request ("provide a switch
# in the admin toggle on and off"). Distinct from the
# MARKET_SCANNER_ENABLED env var, which is the one-time deploy-level
# gate that decides whether the scanning loop exists on this backend
# instance at all (both Render and the VM backup need it set once);
# THIS setting is the runtime pause/resume switch an Admin flips
# without any redeploy — checked once per cycle in
# MarketScanner.scan_once, so turning it off takes effect within one
# interval and turning it back on resumes without restarting the app.
# Defaults to unset/"true" — the scanner runs as soon as the env var
# capability is deployed, same fail-open shape FIREFLIES_ENABLED_KEY
# uses, since Admin explicitly asked for it to be on.
MARKET_SCANNER_ENABLED_KEY = "bots.market_scanner_enabled"

# Super Admin's platform-wide override of the "global" risk defaults
# every trader's own ManualTradingSettings.use_global_defaults=True
# resolves to (services/manual_trading.py's effective_limits) — by
# direct request ("Provide an option to adjust the global risk
# settings in the trader Dashboard ... with a global risk settings
# override in the Admin portal"). Used to be config.py's
# DEFAULT_RISK_PERCENT/DEFAULT_RR_RATIO/MAX_DAILY_TRADES/
# MAX_PORTFOLIO_EXPOSURE — real values, but only changeable by editing
# an env var and redeploying, same gap every other PlatformSetting
# above this one already closed for its own toggle. Value is a JSON
# object ({"risk_per_trade": 1.0, "max_daily_trades": 10,
# "max_portfolio_exposure": 5.0, "min_rr_ratio": 3.0}) rather than 4
# separate keys, so one write updates all 4 atomically — a trader
# switching between them mid-edit could otherwise see a genuinely
# inconsistent mix of old and new defaults. Defaults to unset (falls
# back to config.py's own static values, unchanged behavior) until an
# Admin explicitly sets an override.
GLOBAL_RISK_DEFAULTS_KEY = "trading.global_risk_defaults"

# Super Admin's platform-wide MASTER override of every bot's own
# Starting Reference Capital/Balance (BotConfig.account_balance_usd)
# — by direct request ("Create a master bot control for bot starting
# reference capital and balance ... put master in Admin portal to
# supersede all"). Unlike GLOBAL_RISK_DEFAULTS_KEY above (a soft
# fallback a bot only resolves to when it has no value of its own),
# this is a hard kill-switch-style override, same shape as
# TRADING_PAPER_ENFORCED_KEY: when enabled, its value wins over EVERY
# bot's own setting, platform-wide, no exceptions. Value is a JSON
# object ({"enabled": false, "value": 10000.0}) so the number survives
# being toggled off and back on. Defaults to unset/disabled — each
# bot's own account_balance_usd (or the static config.py default when
# that's unset too) applies until an Admin explicitly turns this on.
MASTER_ACCOUNT_BALANCE_KEY = "trading.master_account_balance"

# Super Admin's platform-wide MASTER override of leverage — both every
# bot's own BotConfig.leverage AND every trader's own
# ManualTradingSettings.leverage — by direct request ("put a form to
# set leverage for Bot and manual - separately on the trader dashboard
# ... with a global override form in the Admin"). Same hard, always-
# wins shape as MASTER_ACCOUNT_BALANCE_KEY above (not a soft fallback
# like GLOBAL_RISK_DEFAULTS_KEY) — when enabled, this ONE leverage
# value applies platform-wide, superseding every bot's and every
# trader's own setting, no exceptions. Value is a JSON object
# ({"enabled": false, "value": 50.0}) so the number survives being
# toggled off and back on. See services/capital_adequacy.py's
# get_effective_leverage for the real resolution order.
MASTER_LEVERAGE_KEY = "trading.master_leverage"
