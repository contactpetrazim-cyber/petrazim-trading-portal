-- Two real production bugs, both the same shape: a Python enum member
-- was added to models/access.py at some point, but the live Postgres
-- enum type backing its column was never altered to match — so any
-- row actually using that value throws
-- "invalid input value for enum ...: '<NAME>'" (asyncpg
-- InvalidTextRepresentationError), confirmed from real production
-- error logs.
--
-- 1. AccessTier.COMMUNITY (models/access.py) — the free/cheap
--    "Community Access" tier used throughout ACCESS_TIER_CATALOGUE and
--    payments.py's start_checkout — but the live `accesstier` enum
--    type only had ESSENTIAL/PROFESSIONAL/EXECUTIVE. Any attempt to
--    grant or purchase Community access failed at the DB layer.
-- 2. PaymentProvider.IVORYPAY (models/access.py, added by an earlier
--    session per its own comment: "was missing — payments.py's
--    start_checkout already accepts provider_override='ivorypay'")
--    — the live `paymentprovider` enum type only had STRIPE/PAYSTACK.
--    Same failure mode for any real IvoryPay checkout.
--
-- ALTER TYPE ... ADD VALUE cannot run inside a multi-statement
-- transaction block together with other DDL in older Postgres, so
-- these are two separate statements/migrations rather than one.

ALTER TYPE accesstier ADD VALUE IF NOT EXISTS 'COMMUNITY';
ALTER TYPE paymentprovider ADD VALUE IF NOT EXISTS 'IVORYPAY';
