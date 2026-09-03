-- Roster assignments — Manager/Partner to Trader relationships
CREATE TABLE IF NOT EXISTS roster_assignments (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trader_user_id        UUID NOT NULL UNIQUE REFERENCES users(id),
    assigned_to_user_id   UUID NOT NULL REFERENCES users(id),
    assigned_by_user_id   UUID REFERENCES users(id),
    assigned_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roster_assigned_to ON roster_assignments(assigned_to_user_id);
