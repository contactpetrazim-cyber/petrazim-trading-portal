-- Petrazim v2 — Core data layer migration
-- =========================================
--
-- HOW TO RUN THIS (novice-friendly):
--
-- Option A — Supabase:
--   1. Open your Supabase project dashboard.
--   2. Click "SQL Editor" in the left sidebar.
--   3. Paste this entire file, click "Run".
--   That's it — no terminal needed.
--
-- Option B — Fly Postgres:
--   1. From Termux or GitHub Codespaces (see the Fly.io workaround from
--      earlier): fly postgres connect -a <your-db-app-name>
--   2. Paste this entire file at the psql prompt, press Enter.
--
-- ALREADY HAVE A TRADES TABLE? Don't run this blindly — read through
-- first and either rename the columns below to match what you already
-- have, or rename your existing table so this one can exist alongside
-- it while you migrate. This migration is written to be safe to re-run
-- (IF NOT EXISTS everywhere), but it won't merge itself into a
-- differently-shaped existing table for you.

-- One table holds every trade — live executions AND backtest runs,
-- distinguished by `source`. This is what lets the Monte Carlo engine,
-- the validation gate, and the weekly review engine all read from one
-- place instead of three.
CREATE TABLE IF NOT EXISTS closed_trades (
    id              BIGSERIAL PRIMARY KEY,
    trade_id        TEXT UNIQUE NOT NULL,
    bot_id          TEXT,
    symbol          TEXT NOT NULL,
    direction       TEXT NOT NULL CHECK (direction IN ('long', 'short')),
    entry_price     DOUBLE PRECISION NOT NULL,
    exit_price      DOUBLE PRECISION NOT NULL,
    stop_price      DOUBLE PRECISION NOT NULL,
    r_multiple      DOUBLE PRECISION NOT NULL,
    entry_time      TIMESTAMPTZ NOT NULL,
    exit_time       TIMESTAMPTZ NOT NULL,
    exit_reason     TEXT NOT NULL CHECK (exit_reason IN ('target', 'stop', 'timeout', 'manual_close')),
    entry_rationale TEXT NOT NULL DEFAULT '',
    -- 'live' = real executed trade. The other three are backtest runs used
    -- by the validation gate (Phase 3/4) — kept in the same table so the
    -- same query shape works everywhere, filtered by `source`.
    source          TEXT NOT NULL DEFAULT 'live'
                    CHECK (source IN ('live', 'backtest', 'backtest_cost_stress', 'backtest_param_variant')),
    -- Groups multiple parameter-variant backtest runs together so the
    -- validation gate can pull "all variants for this test batch".
    variant_group   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_closed_trades_bot_id ON closed_trades(bot_id);
CREATE INDEX IF NOT EXISTS idx_closed_trades_symbol ON closed_trades(symbol);
CREATE INDEX IF NOT EXISTS idx_closed_trades_exit_time ON closed_trades(exit_time);
CREATE INDEX IF NOT EXISTS idx_closed_trades_source ON closed_trades(source, bot_id);


-- Signals your bots generated but that did NOT become a trade — risk
-- rejected, human declined, or the bot was disabled. Feeds the Weekly
-- Review Engine's "missed opportunities" section.
CREATE TABLE IF NOT EXISTS rejected_signals (
    id                    BIGSERIAL PRIMARY KEY,
    signal_id             TEXT UNIQUE NOT NULL,
    bot_id                TEXT,
    symbol                TEXT NOT NULL,
    direction             TEXT NOT NULL CHECK (direction IN ('long', 'short')),
    signal_time           TIMESTAMPTZ NOT NULL,
    entry_price_at_signal DOUBLE PRECISION NOT NULL,
    stop_price            DOUBLE PRECISION NOT NULL,
    target_price          DOUBLE PRECISION NOT NULL,
    rejection_reason      TEXT NOT NULL,
    rationale_at_signal   TEXT NOT NULL DEFAULT '',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rejected_signals_symbol_time ON rejected_signals(symbol, signal_time);
CREATE INDEX IF NOT EXISTS idx_rejected_signals_bot_id ON rejected_signals(bot_id);


-- Emotional journal entries — this is likely close to what your existing
-- Phase 1 journaling engine already stores. If it does, don't create a
-- second table: point _load_journal_entries() at your existing one and
-- just make sure `mood_tag` and `trade_id` exist there under some name.
CREATE TABLE IF NOT EXISTS journal_entries (
    id          BIGSERIAL PRIMARY KEY,
    entry_id    TEXT UNIQUE NOT NULL,
    trade_id    TEXT REFERENCES closed_trades(trade_id),
    entry_date  TIMESTAMPTZ NOT NULL,
    mood_tag    TEXT NOT NULL,
    notes       TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_journal_trade_id ON journal_entries(trade_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_date ON journal_entries(entry_date);


-- Audit trail for the three manual, safety-critical go-live checks
-- (Phase 3/4). Append-only by design — never UPDATE a row here, always
-- INSERT a new one, so the history of who tested what and when is
-- never lost.
CREATE TABLE IF NOT EXISTS gate_attestations (
    id          BIGSERIAL PRIMARY KEY,
    bot_id      TEXT NOT NULL,
    check_name  TEXT NOT NULL
                CHECK (check_name IN ('paper_trading_reconciliation', 'kill_switch_test', 'manual_emergency_close_test')),
    passed      BOOLEAN NOT NULL,
    signed_by   TEXT NOT NULL,
    signed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes       TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_attestations_bot_check ON gate_attestations(bot_id, check_name, signed_at DESC);


-- Webhook idempotency (Phase 1). Only needed if you're not using the
-- Redis-backed store — this gives you a durable dedup table without
-- adding Redis as a dependency.
CREATE TABLE IF NOT EXISTS webhook_events_seen (
    event_id    TEXT PRIMARY KEY,
    seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_expires ON webhook_events_seen(expires_at);
