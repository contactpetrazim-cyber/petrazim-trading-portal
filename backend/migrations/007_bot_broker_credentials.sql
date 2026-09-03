-- Per-bot broker credentials (backend/app/models/broker_credential.py) —
-- lets each bot (or each of your exchange sub-accounts) trade under its
-- own encrypted API key/secret instead of one key shared globally per
-- exchange. See app/services/broker_credentials.py for the encryption.
--
-- As with 006_bot_exchange.sql: a FRESH database picks this table up
-- automatically via create_all() on first boot. This migration is only
-- needed against a database that already existed before this change.

CREATE TABLE IF NOT EXISTS bot_broker_credentials (
    id UUID PRIMARY KEY,
    bot_id VARCHAR(50) NOT NULL REFERENCES bot_configs(bot_id),
    exchange VARCHAR(20) NOT NULL,
    sub_account_label VARCHAR(100),
    api_key_encrypted VARCHAR NOT NULL,
    api_secret_encrypted VARCHAR NOT NULL,
    account_id_encrypted VARCHAR,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_bot_broker_credentials_bot_id ON bot_broker_credentials(bot_id);
