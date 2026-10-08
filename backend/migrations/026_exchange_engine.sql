-- Exchange Engine — by direct request ("Develop an optimal prefered
-- exchange engine that's easy to use ... and reliable ... also
-- integrate the auto switch to available margin capital"). See
-- app/models/bot.py's BotConfig and app/services/exchange_engine.py
-- for the full design. exchange_mode defaults to "fixed" so every
-- existing bot's behavior is completely unchanged until a trader
-- explicitly opts into "auto".

ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS exchange_mode VARCHAR(10) NOT NULL DEFAULT 'fixed';
ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS active_exchange VARCHAR(20);
ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS active_exchange_reason VARCHAR(200);
ALTER TABLE bot_configs ADD COLUMN IF NOT EXISTS active_exchange_picked_at TIMESTAMP;
