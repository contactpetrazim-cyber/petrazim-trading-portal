-- Trading Time Slots — by direct request ("integrate as quick filters
-- for the semi auto and normal bot setups ... also include for global
-- settings for manual trading ... also include an 'All'"). Generalizes
-- the Sub-Auto-only schedule (migration 025) to apply to every bot
-- regardless of mode, and extends the same concept to manual trading's
-- own global settings. See app/services/trading_sessions.py for the
-- real session definitions (converted from real forex session hours)
-- and app/models/bot.py's BotConfig / app/models/trade.py's
-- ManualTradingSettings for the full column comments.
--
-- sub_auto_sessions/sub_auto_days/sub_auto_half_day (migration 025)
-- are dropped, not kept alongside the new columns: confirmed zero
-- production rows had ever set any of the three before this rename
-- (the feature shipped the same day it's being generalized here), so
-- there is nothing to migrate forward.

ALTER TABLE bot_configs DROP COLUMN IF EXISTS sub_auto_sessions;
ALTER TABLE bot_configs DROP COLUMN IF EXISTS sub_auto_days;
ALTER TABLE bot_configs DROP COLUMN IF EXISTS sub_auto_half_day;

ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS schedule_sessions JSON;
ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS schedule_days JSON;
ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS schedule_half_day VARCHAR(2);

ALTER TABLE manual_trading_settings ADD COLUMN IF NOT EXISTS schedule_sessions JSON;
ALTER TABLE manual_trading_settings ADD COLUMN IF NOT EXISTS schedule_days JSON;
ALTER TABLE manual_trading_settings ADD COLUMN IF NOT EXISTS schedule_half_day VARCHAR(2);
