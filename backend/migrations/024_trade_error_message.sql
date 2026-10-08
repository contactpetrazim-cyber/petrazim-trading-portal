-- Persist WHY a trade landed at status=ERROR — by direct report
-- ("critically review this error ... fix ... permanently").
--
-- Investigating a real ERROR trade live meant reconstructing what
-- failed entirely from `docker logs` — which do NOT survive a
-- redeploy (confirmed directly: the container that logged one of the
-- two real trades investigated for this fix was already gone by the
-- time it was looked into, hours later, leaving no record of the
-- actual failure reason anywhere). This column means every future
-- occurrence is self-diagnosing from the DB/UI instead.
--
-- See execution_engine.py's _mark_trade_error (also fixed alongside
-- this migration to stop clobbering an already-CLOSED/CANCELLED
-- trade's status — confirmed live against one of the two trades that
-- position_monitor.py had already correctly closed moments before
-- this overwrote it back to ERROR) and manual_trading.py's own
-- equivalent failure path for where this gets set.

ALTER TABLE trades ADD COLUMN IF NOT EXISTS error_message TEXT;
