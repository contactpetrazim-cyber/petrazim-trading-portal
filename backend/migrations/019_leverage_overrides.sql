-- Leverage overrides — per-bot, per-trader (manual), and the Admin
-- master override
-- ====================================================================
--
-- By direct request ("put a form to set leverage for Bot and manual -
-- separately on the trader dashboard ... with a global override form
-- in the Admin"). Both columns are NULL-means-no-override, same shape
-- as BotConfig.account_balance_usd / the earlier Master Bot Control
-- feature. See services/capital_adequacy.py's get_effective_leverage
-- for the real resolution order (Admin master override always wins,
-- else this bot's/trader's own value, else config.py's static
-- MAX_NOTIONAL_LEVERAGE). The Admin master override itself
-- (trading.master_leverage) is a PlatformSetting row — no schema
-- change needed for that one.

ALTER TABLE bot_configs
ADD COLUMN IF NOT EXISTS leverage DOUBLE PRECISION;

ALTER TABLE manual_trading_settings
ADD COLUMN IF NOT EXISTS leverage DOUBLE PRECISION;
