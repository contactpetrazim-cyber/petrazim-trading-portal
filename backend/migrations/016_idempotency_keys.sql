-- Idempotency-Key dedup ledger
-- =================================
--
-- One row per (user, endpoint, client-supplied key). Backs a shared
-- guard (app/core/idempotency.py) added to the mutating endpoints
-- where a retried request must not re-run the underlying action a
-- second time — concretely:
--   - manual_trading.place_order: a retried order placement must not
--     place a duplicate order. This app's own frontend already
--     retries mutating calls through a Render cold start
--     (resilientFetch.ts's fetchWithRetry), and a trader can always
--     double-tap a slow "Place Order" button regardless — until now
--     there was nothing stopping either from actually executing twice.
--   - admin.change_role / change_role_by_email / create_user /
--     delete_user: a retried Role Administration action shouldn't
--     silently double-apply (e.g. two audit-adjacent side effects) or
--     race with itself.
--   - curriculum.complete_stage / complete_game / submit_quiz /
--     submit_practice: complete_game in particular had NO dedup at
--     all before this — every call unconditionally awarded XP, so a
--     retried request doubled it outright. complete_stage's own
--     "already completed" check is a plain SELECT with no unique
--     constraint backing it, so two genuinely concurrent retries could
--     both pass the check before either commits and both award XP.
--
-- The UNIQUE constraint below is what actually closes the race: the
-- second of two concurrent requests with the same key loses the
-- INSERT with an IntegrityError, which the guard turns into a clean
-- 409 instead of a second real mutation.
--
-- completed_at IS NULL while the original request is still being
-- processed — lets a genuinely concurrent duplicate be told "already
-- in progress" (409) rather than racing the eventual write. Once
-- completed_at is set, response_status/response_body hold the exact
-- response a replay should return, so a retry AFTER the original
-- finished sees the same answer instead of re-running anything.

CREATE TABLE IF NOT EXISTS idempotency_records (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    endpoint VARCHAR(100) NOT NULL,
    idempotency_key VARCHAR(200) NOT NULL,
    response_status INTEGER,
    response_body JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT uq_idempotency_user_endpoint_key UNIQUE (user_id, endpoint, idempotency_key)
);

CREATE INDEX IF NOT EXISTS ix_idempotency_records_lookup
    ON idempotency_records (user_id, endpoint, idempotency_key);
