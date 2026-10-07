-- Margin auto-switch engine — "dedicated Vs Auto margin account
-- setting for bots and manual", plus the Trade-level visibility flag
-- for a fill that actually used the fallback.
-- ====================================================================
--
-- By direct request ("Create an automatic switch engine that checks
-- which accounts have margin capital to trade and if the dedicated
-- accounts do not have money it can switch to the account that has
-- margin to take the trade — there should be a dedicated Vs Auto
-- margin account setting for bots and manual and also a master switch
-- in the Admin portal"). See app/models/bot.py's MarginMode and
-- app/services/margin_switch_engine.py for the full design.
--
-- The Admin portal's own master switch needs no schema change — it's
-- a PlatformSetting row (MARGIN_AUTO_SWITCH_ENABLED_KEY), the same
-- generic key/value table every other master switch here already
-- uses, and that table already exists.

-- Native Postgres ENUM, matching every other SQLAlchemy Enum() column
-- in this app (e.g. botstatus, executionmode, tradingmode,
-- connectionmode) — the type name SQLAlchemy expects is the Python
-- class name lowercased: MarginMode -> marginmode.
DO $$ BEGIN
    CREATE TYPE marginmode AS ENUM ('dedicated', 'auto_switch');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE bot_configs
ADD COLUMN IF NOT EXISTS margin_mode marginmode NOT NULL DEFAULT 'dedicated';

ALTER TABLE trader_broker_connections
ADD COLUMN IF NOT EXISTS margin_mode marginmode NOT NULL DEFAULT 'dedicated';

ALTER TABLE trades
ADD COLUMN IF NOT EXISTS margin_switch_used BOOLEAN DEFAULT FALSE;
