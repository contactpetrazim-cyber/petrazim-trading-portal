-- Bot strategy_key — decouples "which of the 5 fixed SMC algorithms
-- this bot runs" from its own unique bot_id, so a trader can run more
-- than one bot instance per strategy.
-- ====================================================================
--
-- By direct request ("I cant seem to be able to create more than 5
-- bots even though I don't mind repeating the bot strategy ... we
-- should always be able to update or add bots to the portal from now
-- for the future"). Root cause: BotOrchestrator.run_all
-- (app/core/bot_strategies.py) used to call each of the 5 strategy
-- classes exactly once per scan cycle, tagging every signal with that
-- class's own hardcoded bot_id — a cloned bot with any other bot_id
-- could never receive a signal at all, since nothing addressed it.
-- This column is the real fix's foundation: strategy_key identifies
-- WHICH algorithm (bot_1..bot_5) a bot instance runs, independent of
-- its own bot_id (still unique, still whatever the trader names it or
-- the auto-suffix generates for a repeat strategy).
--
-- Backfilled for the 5 existing bots by deriving it from their own
-- current bot_id prefix (the same "_".join(bot_id.split("_")[:2])
-- convention market_scanner.py's own grouping already relied on) —
-- a safe, data-preserving backfill with zero behavior change for any
-- bot that already exists.

ALTER TABLE bot_configs
ADD COLUMN IF NOT EXISTS strategy_key VARCHAR(10);

UPDATE bot_configs
SET strategy_key = SUBSTRING(bot_id FROM '^(bot_[0-9]+)')
WHERE strategy_key IS NULL AND bot_id ~ '^bot_[0-9]+_';
