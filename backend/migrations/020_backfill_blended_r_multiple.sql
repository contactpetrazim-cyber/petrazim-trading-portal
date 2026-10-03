-- Correct r_multiple for every trade closed via multiple partial legs
-- ====================================================================
--
-- Critical bug, found via direct report with real numbers that didn't
-- add up: a trade's r_multiple was computed from ONLY the final
-- closing leg's price (position_monitor.py's _close, manual_trading.
-- py's partial_close 100%-case and cancel_order's ACTIVE fallback,
-- webhook_processor.py's own management-close path), completely
-- ignoring that earlier partial closes (TP1, TP2, ...) already locked
-- in profit at different, lower R-multiples. A 30/40/30-allocation
-- trade that closed 30% at 1R, 40% at 2R, and the final 30% at 3R
-- truly realized a capital-weighted 0.3x1 + 0.4x2 + 0.3x3 = 2.0R —
-- exactly what realized_pnl/risk_amount gives — but the stored
-- r_multiple said 3.0R (the final leg's own price-only ratio),
-- overstating real performance on every multi-leg trade's own record
-- and on every "Average R" statistic that reads this column.
--
-- See services/manual_trading.py's new compute_blended_r_multiple for
-- the real fix applied to every close site going forward. This
-- migration applies the exact same, strictly-more-correct formula
-- retroactively: realized_pnl/risk_amount is mathematically identical
-- to the old price-only formula for a single-leg close (lot_size
-- cancels out algebraically — see that function's own docstring), so
-- this is a safe, lossless correction for every trade, not just the
-- multi-leg ones; it only actually CHANGES a value for a trade whose
-- r_multiple was wrong in the first place.
--
-- Only touches CLOSED trades with both a real realized_pnl and a real
-- risk_amount already set — the same two inputs compute_blended_
-- r_multiple itself requires before trusting this formula over the
-- old one.

UPDATE trades
SET r_multiple = realized_pnl / risk_amount
WHERE status = 'CLOSED'
  AND realized_pnl IS NOT NULL
  AND risk_amount IS NOT NULL
  AND risk_amount > 0;
