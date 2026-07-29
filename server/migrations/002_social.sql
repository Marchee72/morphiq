-- Training partners.
--
-- The first cross-user data in the app. Everything before this hangs off a
-- single `"profileId"` and is visible to exactly one person; these tables are
-- the only ones where two accounts meet, which is why the guards that read them
-- live apart from the ones that read everything else (see `guardBuddyLink`).
--
-- Replayed on every cold start like every other migration, so every statement is
-- guarded and a partial run can simply be repeated.

-- ─── The friendship itself ──────────────────────────────────────────────────
--
-- One row per friendship, not two directed rows. Two rows would mean every
-- read is a UNION and every write has to remember to touch both — and the day
-- one of them is missed, one side sees a friend the other does not.
--
-- The pair is normalised numerically before it is written (`orderPair` in
-- social.js), so (3,7) and (7,3) are the same row and the UNIQUE constraint is
-- what actually stops a duplicate friendship rather than a hopeful SELECT.
--
-- The edge joins profiles, not users: all training data hangs off "profileId",
-- and presence is a property of the profile that is training. The user ids ride
-- along so a redemption can refuse to befriend two profiles of one account.
CREATE TABLE IF NOT EXISTS buddy_links (
  id SERIAL PRIMARY KEY,
  "profileIdA" TEXT NOT NULL,
  "profileIdB" TEXT NOT NULL,
  "userIdA" INTEGER NOT NULL REFERENCES users(id),
  "userIdB" INTEGER NOT NULL REFERENCES users(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Which side pulled the plug. NULL means the link is active. Blocking keeps
  -- the row (and the messages) and closes the guards; removing deletes it.
  "blockedByProfileId" TEXT,
  "blockedAt" TIMESTAMPTZ,
  UNIQUE ("profileIdA", "profileIdB")
);

CREATE INDEX IF NOT EXISTS buddy_links_a_idx ON buddy_links("profileIdA");
CREATE INDEX IF NOT EXISTS buddy_links_b_idx ON buddy_links("profileIdB");

-- ─── Invitations ────────────────────────────────────────────────────────────
--
-- A code you send over WhatsApp, not a search by email: nothing here lets one
-- account probe for another's existence.
--
-- Single-use and short-lived, because a code that stays valid forever is a
-- permanent key to your training presence sitting in somebody's chat history.
-- `"revokedAt"` covers the two ways a code dies without being used — you minted
-- a new one, or you changed your mind.
CREATE TABLE IF NOT EXISTS buddy_invites (
  id SERIAL PRIMARY KEY,
  -- Stored uppercase so lookup is exact; the client uppercases what is typed.
  code TEXT NOT NULL UNIQUE,
  "inviterUserId" INTEGER NOT NULL REFERENCES users(id),
  "inviterProfileId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "redeemedAt" TIMESTAMPTZ,
  "redeemedByUserId" INTEGER REFERENCES users(id),
  "redeemedByProfileId" TEXT,
  "revokedAt" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS buddy_invites_inviter_idx ON buddy_invites("inviterProfileId");

-- ─── Redemption attempts ────────────────────────────────────────────────────
--
-- Rate limiting has to be a table rather than a counter in memory: two requests
-- to a serverless deployment are two processes, and a per-process counter would
-- reset itself often enough to be decorative.
--
-- Only redemptions are recorded, because guessing codes is the one thing here
-- worth slowing down.
CREATE TABLE IF NOT EXISTS social_attempts (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  succeeded BOOLEAN NOT NULL,
  "at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS social_attempts_user_at_idx ON social_attempts("userId", "at");

-- ─── Presence preference ────────────────────────────────────────────────────
--
-- Defaults to true: the feature is worth having switched on, and a partner who
-- can never see you training is a friend list that does nothing.
--
-- It lives on the profile rather than in localStorage because the server is what
-- honours it — a preference the server cannot read cannot stop it from sending
-- your presence to somebody.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS "sharePresence" BOOLEAN NOT NULL DEFAULT TRUE;
