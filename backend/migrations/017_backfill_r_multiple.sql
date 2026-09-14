-- Backfill Trade.r_multiple for already-closed trades
-- =================================================
--
-- Found during a critical review of trading calculations/metrics:
-- Trade.r_multiple was declared on the model (app/models/trade.py)
-- but NEVER assigned anywhere in the backend — confirmed via a full
-- search for `.r_multiple =` across app/. Every real trade closed
-- through this app has r_multiple = NULL, which silently zeroed out
-- "average R" everywhere it's read (bots.py's /performance, and
-- dashboard.py's /performance's average_r_multiple) for every bot and
-- every trader, regardless of actual trade history — both endpoints'
-- own list comprehensions filter `r_multiple is not None`, so the
-- list was always empty and the average always read 0.0.
--
-- app/services/manual_trading.py's new compute_r_multiple() is now
-- wired into every real close site going forward (partial_close's
-- 100% case, cancel_order's ACTIVE fallback-to-close, and
-- position_monitor.py's own SL/TP auto-close) — see that function's
-- own docstring for the formula and sign convention. This migration
-- applies the exact same formula retroactively to every trade that
-- was already CLOSED before that fix shipped, so historical
-- performance numbers become accurate immediately rather than only
-- trades closed from here on.
--
-- Only touches rows where r_multiple IS NULL (nothing to overwrite —
-- confirmed above that nothing ever set it) and stop_loss actually
-- differs from entry_price (the same guard compute_r_multiple applies
-- in Python, to avoid a division by zero for the handful of rows that
-- could theoretically have equal entry/stop from a very old, pre-
-- validation row).

UPDATE trades
SET r_multiple = CASE
    WHEN direction = 'LONG' THEN (exit_price - entry_price) / ABS(entry_price - stop_loss)
    ELSE (entry_price - exit_price) / ABS(entry_price - stop_loss)
END
WHERE status = 'CLOSED'
  AND r_multiple IS NULL
  AND entry_price IS NOT NULL
  AND exit_price IS NOT NULL
  AND stop_loss IS NOT NULL
  AND entry_price != stop_loss;
