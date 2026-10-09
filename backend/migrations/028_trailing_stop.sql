-- Trailing exit on the final runner leg — the real "let winners run"
-- mechanism, by direct request after a real screenshot showed Actual R
-- capped at ~2.3R repeatedly on every winning trade ("how can the
-- actual R for wins be improved"). See app/models/trade.py's Trade and
-- ManualTradingSettings, app/models/bot.py's BotConfig, and
-- app/services/position_monitor.py's _check_trailing for the full
-- comments on each column/the mechanism itself.

ALTER TABLE trades ADD COLUMN IF NOT EXISTS trailing_activation_r FLOAT DEFAULT 2.0;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS trailing_active BOOLEAN DEFAULT FALSE;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS trailing_peak_price FLOAT;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS trailing_stop_price FLOAT;

ALTER TABLE manual_trading_settings ADD COLUMN IF NOT EXISTS use_trailing_stop BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE manual_trading_settings ADD COLUMN IF NOT EXISTS trailing_activation_r FLOAT;

-- BotConfig.trailing_stop_activation already exists (added before this
-- session, never actually read/acted on anywhere until now) — flip its
-- default from 1.0 to 2.0 (TP2, by direct instruction "default is
-- TP2") and backfill every existing row still sitting on the old,
-- never-acted-on 1.0 default. Safe: since nothing ever read this
-- column before now, no bot's real behavior changes from this
-- backfill alone — it only sets up the NEW feature's intended default
-- correctly from day one, rather than silently defaulting every
-- pre-existing bot to the bigger, non-default "after TP1" behavior.
ALTER TABLE bot_configs ALTER COLUMN trailing_stop_activation SET DEFAULT 2.0;
UPDATE bot_configs SET trailing_stop_activation = 2.0 WHERE trailing_stop_activation = 1.0;
