-- Backs the Learning Console gap-close: adapting the reference
-- training portal's Trainer/Manager/Admin console pattern (cohorts,
-- roster, access codes, facilitator sessions, platform overview) onto
-- this app's real data model — see routers/corporate.py, roster.py,
-- admin.py, facilitator.py, and community_broadcast.py.

-- "Hold"/"Resume" on an issued seat code, without deleting it.
ALTER TABLE access_codes ADD COLUMN IF NOT EXISTS is_held BOOLEAN NOT NULL DEFAULT false;

-- One row per real Telegram broadcast dispatch — backs the Admin
-- console's "Daily sends" counter with an actual count instead of a
-- guess (see models/broadcast_log.py).
CREATE TABLE IF NOT EXISTS broadcast_logs (
    id UUID PRIMARY KEY,
    kind VARCHAR(50) NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_broadcast_logs_sent_at ON broadcast_logs (sent_at);
