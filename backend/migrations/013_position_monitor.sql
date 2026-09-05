-- Backs the new automated Paper-Trading position monitor (services/
-- position_monitor.py) — closes/partial-closes a TEST-mode trade for
-- real the moment a live price actually touches its stop or a take-
-- profit level, instead of it sitting ACTIVE forever until manually
-- closed. By direct request, from the very first paper-trading ask
-- this session: "simulate trade management with live price data."
--
-- These two booleans track which intermediate take-profit levels have
-- already fired for a trade with multiple targets (TP1 while TP2/TP3
-- are also set), so the monitor doesn't re-trigger the same partial
-- close on every poll cycle while price sits past that level. No
-- equivalent column needed for the final configured target or for
-- stop-loss — either one closes the position outright, ending the
-- ACTIVE loop for that trade entirely.

ALTER TABLE trades ADD COLUMN IF NOT EXISTS tp1_triggered BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE trades ADD COLUMN IF NOT EXISTS tp2_triggered BOOLEAN NOT NULL DEFAULT false;
