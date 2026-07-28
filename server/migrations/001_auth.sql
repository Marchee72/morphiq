-- Google sign-in.
--
-- Until now the API had no authentication at all and CORS was open to every
-- origin, so anyone who knew the URL could read and write every profile. This
-- adds an owner to the data.
--
-- Written to be safe to run more than once: every statement is guarded, so a
-- partial run can simply be repeated.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  -- Google's stable subject id. Email is not the key: people change theirs, and
  -- Google explicitly documents `sub` as the only durable identifier.
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT,
  name TEXT,
  picture TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "lastSeenAt" TIMESTAMPTZ
);

-- Profiles belong to a user. Nullable on purpose: the rows that exist today have
-- no owner, and the first sign-in adopts them (see `adoptOrphanProfiles`).
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);

CREATE INDEX IF NOT EXISTS user_profiles_user_id_idx ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS users_google_sub_idx ON users(google_sub);
