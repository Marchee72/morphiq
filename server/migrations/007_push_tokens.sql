-- Devices to wake up for a partner event.
--
-- Kept out of `user_profiles`: a profile has zero or many devices registered
-- for push at once (a phone and a browser tab, say), and a column cannot hold
-- that. Scoped to a profile rather than a user for the same reason everything
-- else in social is — a partner's presence and messages are per-profile, so
-- the notification they trigger has to be too.
--
-- Replayed on every cold start like every other migration, so every statement
-- is guarded and a partial run can simply be repeated.

CREATE TABLE IF NOT EXISTS push_tokens (
  id SERIAL PRIMARY KEY,
  "profileId" TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'web')),
  -- An FCM registration token for 'android'; a JSON-encoded `PushSubscription`
  -- for 'web'. Opaque either way — this table never parses it, only stores and
  -- hands it to the platform that issued it.
  token TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Re-registering the same device (a token FCM rotates, a resumed web
-- subscription) is a fact refresh, not a new row.
CREATE UNIQUE INDEX IF NOT EXISTS push_tokens_profile_platform_token_idx
  ON push_tokens("profileId", platform, token);

-- Every send is "who is registered for this profile".
CREATE INDEX IF NOT EXISTS push_tokens_profile_idx ON push_tokens("profileId");
