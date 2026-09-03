-- Adds BotConfig.exchange (backend/app/models/bot.py) — which exchange a
-- bot's orders execute on, and which live ticker the cross-exchange
-- price-deviation guard checks against (execution_engine.py).
--
-- NOTE: main.py's lifespan already runs SQLAlchemy's create_all() on
-- every boot, so a FRESH database (a new Render/Supabase Postgres that's
-- never seen bot_configs before) picks this column up automatically —
-- this migration is only needed against a database where bot_configs
-- already existed before this change (e.g. this repo's local dev DB).
-- create_all() creates missing TABLES, it does not ALTER existing ones.

ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS exchange VARCHAR(20);
