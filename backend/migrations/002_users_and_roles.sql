-- v3 Migration — Users, Roles, Super Admin seed
-- =================================================
-- Run this AFTER migrations/001 (from the earlier Monte Carlo/backtest
-- data layer) if you're using that data layer, or standalone against
-- your existing Postgres if not — this only touches a new `users` table.

CREATE TYPE user_role AS ENUM ('trader', 'fund_manager', 'partner', 'admin', 'super_admin');
CREATE TYPE user_status AS ENUM ('pending', 'active', 'suspended', 'access_expired');

CREATE TABLE IF NOT EXISTS users (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                  TEXT UNIQUE NOT NULL,
    phone                  TEXT,
    full_name              TEXT NOT NULL,
    hashed_password        TEXT NOT NULL,
    role                   user_role NOT NULL DEFAULT 'trader',
    status                 user_status NOT NULL DEFAULT 'pending',
    is_super_admin_seed    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by             UUID REFERENCES users(id),
    last_login_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- Enforce at most one seeded Super Admin at the database level too,
-- not just the application layer in core/auth.py — belt and suspenders
-- for the account that can create/remove every other account.
CREATE UNIQUE INDEX IF NOT EXISTS idx_only_one_super_admin_seed
    ON users (is_super_admin_seed)
    WHERE is_super_admin_seed = TRUE;
