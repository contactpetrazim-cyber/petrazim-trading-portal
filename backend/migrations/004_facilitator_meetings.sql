-- Facilitator meetings migration
-- Run after the users/access migrations already in place.

CREATE TYPE meeting_band AS ENUM ('am', 'afternoon', 'evening');
CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled', 'completed');

CREATE TABLE IF NOT EXISTS meeting_bookings (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainee_user_id        UUID NOT NULL REFERENCES users(id),
    facilitator_user_id    UUID REFERENCES users(id),
    day                    DATE NOT NULL,
    band                   meeting_band NOT NULL,
    topic                  TEXT NOT NULL,
    jitsi_room_url         TEXT NOT NULL,
    fireflies_meeting_id   TEXT,
    status                 booking_status NOT NULL DEFAULT 'confirmed',
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_bookings_day ON meeting_bookings(day, status);
CREATE INDEX IF NOT EXISTS idx_meeting_bookings_trainee ON meeting_bookings(trainee_user_id);

CREATE TABLE IF NOT EXISTS external_connectors (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_type            TEXT NOT NULL UNIQUE,
    is_connected              TEXT NOT NULL DEFAULT 'false',
    connected_account_label   TEXT,
    connected_at              TIMESTAMPTZ
);

INSERT INTO external_connectors (connector_type, is_connected) VALUES
    ('fireflies', 'false'),
    ('google_calendar_individual', 'false'),
    ('google_calendar_corporate', 'false')
ON CONFLICT (connector_type) DO NOTHING;
