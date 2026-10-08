-- Sub-Auto Schedule — by direct request ("additional quick filters
-- for semi auto for bot trading : session, days, am and pm etc"),
-- confirmed as an execution gate: outside the configured window(s),
-- a signal that would otherwise be pre-approved by Sub-Auto instead
-- falls back to this bot's own normal execution_mode. NULL/[] on any
-- of these means "All" for that dimension (no restriction) — by
-- direct request ("Add option for All - which includes everything -
-- not filtered"). See app/models/bot.py's BotConfig and
-- app/services/execution_engine.py's _sub_auto_window_allows for the
-- full semantics and exact session UTC ranges.

ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS sub_auto_sessions JSON;
ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS sub_auto_days JSON;
ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS sub_auto_half_day VARCHAR(2);
