-- Adds per-user ownership to the trading engine (BotConfig.user_id,
-- Trade.user_id) — the tables existed with zero concept of "whose bot/
-- trade this is" (dashboard.py/trades.py/bots.py had no auth checks
-- at all). Nullable because pre-existing rows have no owner to
-- backfill to; confirmed via `select count(*) from trades, bot_configs`
-- against the live Supabase project before writing this — both were
-- empty (0 rows), so there is nothing to backfill and no ambiguity.
-- Every bot created from here on sets user_id from the authenticated
-- caller (routers/bots.py::create_bot); every trade a signal produces
-- inherits its owning bot's user_id (execution_engine.py::_persist_trade).
--
-- NOTE: main.py's lifespan runs SQLAlchemy's create_all() on every
-- boot, which creates missing TABLES but does not ALTER existing ones
-- — same reasoning as 006_bot_exchange.sql. Applied directly against
-- the live Supabase project (eacpktuyicxutatxuokw) in this session
-- since both tables were confirmed empty.

ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE trades ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_bot_configs_user_id ON bot_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
