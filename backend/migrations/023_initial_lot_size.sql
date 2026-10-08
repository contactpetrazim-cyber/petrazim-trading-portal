-- Preserve the ORIGINAL position size — "Qty: 0.000" bug
-- ====================================================================
--
-- Critical bug, found via direct report ("Observed that the quantity
-- on the card shows 0.000"): Trade.lot_size is used, by design, as the
-- LIVE REMAINING open size — position_monitor.py's _partial_close
-- decrements it as each TP leg consumes part of the position, and
-- _close (and manual_trading.py's own cancel_order/partial_close
-- 100%-case) sets it to exactly 0.0 once nothing is left open. That's
-- correct for the P&L math each of those functions does in the
-- moment, but it means the PERSISTED lot_size on every trade that has
-- ever fully closed — bot or manual, partial-TP or not — is always
-- 0, with the real opening size gone. Every closed trade's card was
-- showing "Qty: 0.000" regardless of what was actually traded.
--
-- Same shape as initial_stop_loss/initial_take_profit_1 (migrations/
-- 012_trade_modification_tracking.sql): an immutable snapshot taken
-- once at open, never touched by anything that mutates the live
-- column afterward.
--
-- Backfill for existing rows:
--   - Still PENDING/ACTIVE (lot_size never zeroed yet): initial_lot_size
--     is just today's lot_size.
--   - Already CLOSED (lot_size already 0): recovered from the already-
--     verified portal-wide invariant risk_amount = lot_size * |entry -
--     initial_stop_loss| → lot_size = risk_amount / |entry -
--     initial_stop_loss|. Falls back to initial_stop_loss over the
--     (possibly-trailed) live stop_loss since that's the distance the
--     ORIGINAL lot size was actually sized against.

ALTER TABLE trades ADD COLUMN IF NOT EXISTS initial_lot_size FLOAT;

UPDATE trades
SET initial_lot_size = lot_size
WHERE initial_lot_size IS NULL
  AND lot_size > 0;

UPDATE trades
SET initial_lot_size = risk_amount / ABS(entry_price - initial_stop_loss)
WHERE initial_lot_size IS NULL
  AND risk_amount IS NOT NULL
  AND risk_amount > 0
  AND entry_price IS NOT NULL
  AND initial_stop_loss IS NOT NULL
  AND initial_stop_loss <> entry_price;
