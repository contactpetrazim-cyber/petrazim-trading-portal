-- First-time "How the Programme Works" auto-trigger flag
-- ========================================================
--
-- By direct request: dashboard buttons should open the "How the
-- Programme Works" modal first for a brand-new user, until they've
-- seen it once, then behave normally (navigate straight through).
-- The account is the source of truth (localStorage is just a local
-- backup on the frontend) — see User.has_seen_programme_intro's own
-- comment in app/models/user.py and the new PATCH
-- /auth/programme-intro-seen endpoint in app/routers/auth.py.
--
-- Defaults to false for every existing row, which is correct: no
-- existing trader has been auto-shown this new flow yet, so the very
-- first dashboard click after this ships will trigger it once for
-- everyone already registered, same as for a brand-new signup.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS has_seen_programme_intro BOOLEAN NOT NULL DEFAULT FALSE;
