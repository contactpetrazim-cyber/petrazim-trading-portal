-- Trailing Loss Guard — manual trading's own on/off switch, by direct
-- request ("Can we apply similar and adapt to manual trading with an
-- on or off guard toggle"). See app/models/trade.py's
-- ManualTradingSettings.use_loss_guard and app/services/
-- trailing_loss_guard.py for the full mechanism this gates.

ALTER TABLE manual_trading_settings ADD COLUMN IF NOT EXISTS use_loss_guard BOOLEAN NOT NULL DEFAULT TRUE;
