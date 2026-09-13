CREATE TABLE IF NOT EXISTS kakao_identity (
  user_id uuid PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  app_id text NOT NULL,
  subject text NOT NULL,
  phone_e164 text,
  status text NOT NULL CHECK (status IN ('confirmed', 'unavailable', 'pending')),
  version integer NOT NULL DEFAULT 1,
  checked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(app_id, subject),
  CHECK ((status = 'confirmed') = (phone_e164 IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS kakao_session_check (
  session_id uuid PRIMARY KEY REFERENCES "session"(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  identity_version integer NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON ALL TABLES IN SCHEMA kakao_test_auth FROM PUBLIC;
