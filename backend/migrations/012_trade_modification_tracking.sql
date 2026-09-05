-- Backs the new "how a trader changes their plan" analytics — by
-- direct request: "TP or SL changes per trade over time - a measure
-- how you change your trading plan ... effects of multiple TP trades
-- vs single TP per trade ... same for dynamic SL management shift vs
-- trades without shifting SL over time."
--
-- `trades.trade_logs` (models/trade.py's TradeLog, event_type already
-- documented as including "sl_update"/"tp_hit" etc.) already existed
-- with the right shape for this — nothing wrote to it yet, so no new
-- table needed, just real writes at last.
--
-- Two new immutable columns capture what a trade's SL/TP1 were AT
-- CREATION, distinct from the mutable `stop_loss`/`take_profit_1`
-- columns modify_targets already updates in place — without these,
-- "was this trade's SL ever shifted from where it opened" has no
-- honest answer once the live value has been overwritten. Backfilled
-- from the current stop_loss/take_profit_1 for every pre-existing row
-- (checked first: this is the best information available for a trade
-- opened before this column existed — there was no modification log
-- being written before now either, so nothing better to backfill
-- from).

ALTER TABLE trades ADD COLUMN IF NOT EXISTS initial_stop_loss DOUBLE PRECISION;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS initial_take_profit_1 DOUBLE PRECISION;

UPDATE trades SET initial_stop_loss = stop_loss WHERE initial_stop_loss IS NULL;
UPDATE trades SET initial_take_profit_1 = take_profit_1 WHERE initial_take_profit_1 IS NULL AND take_profit_1 IS NOT NULL;
