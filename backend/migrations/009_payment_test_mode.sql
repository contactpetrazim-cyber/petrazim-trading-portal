-- Test vs Live payment mode: a real Super-Admin-controlled runtime
-- toggle (not just an env var — see routers/payments.py's GET/PATCH
-- /payments/mode), plus the column that marks a Payment as a
-- simulated one. Checked the live project first: `payments` was
-- empty (0 rows) and no platform_settings table existed yet.

CREATE TABLE IF NOT EXISTS platform_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;
