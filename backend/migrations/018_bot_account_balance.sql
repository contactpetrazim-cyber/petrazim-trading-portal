-- Master Bot Control — per-bot Starting Reference Capital/Balance
-- ====================================================================
--
-- By direct request ("Create a master bot control for bot starting
-- reference capital and balance ... put master in Admin portal to
-- supersede all"). This is the REAL account balance a bot's own
-- signal sizing is computed against (see get_effective_account_balance
-- in app/services/market_scanner.py) — not just a display figure.
-- NULL means "no override for this bot": falls back to the Admin's
-- platform-wide master override (trading.master_account_balance, a
-- PlatformSetting row — no schema change needed for that one) when
-- enabled, else config.py's own static MARKET_SCANNER_DEFAULT_ACCOUNT_
-- BALANCE, exactly the flat constant every bot silently used before
-- this feature existed.

ALTER TABLE bot_configs
ADD COLUMN IF NOT EXISTS account_balance_usd DOUBLE PRECISION;
