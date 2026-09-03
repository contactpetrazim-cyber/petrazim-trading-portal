-- v3 Migration — Access tiers, payments, codes, Telegram links
-- ==================================================================
-- Run after 002_users_and_roles.sql. Same paste-into-Supabase-SQL-Editor
-- method as before.

CREATE TYPE access_tier AS ENUM ('essential', 'professional', 'executive');
CREATE TYPE duration_pass_type AS ENUM ('one_day', 'half_day', 'am', 'pm', 'three_hour_refresh', 'one_module');
CREATE TYPE code_type AS ENUM ('promo', 'partner_referral', 'corporate_seat');
CREATE TYPE payment_provider AS ENUM ('stripe', 'paystack');
CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');
CREATE TYPE telegram_channel AS ENUM ('individual', 'corporate');

CREATE TABLE IF NOT EXISTS user_access (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES users(id),
    tier                 access_tier NOT NULL,
    granted_via          TEXT NOT NULL,
    duration_pass_type   duration_pass_type,
    starts_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at           TIMESTAMPTZ NOT NULL,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_access_user_active ON user_access(user_id, is_active, expires_at);

CREATE TABLE IF NOT EXISTS access_codes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code                TEXT UNIQUE NOT NULL,
    code_type           code_type NOT NULL,
    tier_granted        access_tier NOT NULL,
    duration_hours      INTEGER NOT NULL DEFAULT 720,
    issued_by_user_id   UUID REFERENCES users(id),
    max_redemptions     INTEGER NOT NULL DEFAULT 1,
    redemption_count    INTEGER NOT NULL DEFAULT 0,
    expires_at          TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_access_codes_code ON access_codes(code);

CREATE TABLE IF NOT EXISTS payments (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID NOT NULL REFERENCES users(id),
    provider              payment_provider NOT NULL,
    provider_reference    TEXT,
    status                payment_status NOT NULL DEFAULT 'pending',
    amount                DOUBLE PRECISION NOT NULL,
    currency              TEXT NOT NULL,
    tier_purchased        access_tier,
    duration_pass_type    duration_pass_type,
    seat_count            INTEGER,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);

CREATE TABLE IF NOT EXISTS telegram_links (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id),
    telegram_user_id    BIGINT NOT NULL,
    telegram_username   TEXT,
    channel             telegram_channel NOT NULL,
    invite_link_used    TEXT,
    joined_at           TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_telegram_links_tg_user ON telegram_links(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_links_user ON telegram_links(user_id);
