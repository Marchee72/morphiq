-- Training together.
--
-- A shared session is a *container*, not a synchronised workout. Two partners
-- agree to be in the gym at the same time; each does their own exercises, at
-- their own weights, at their own pace. Nothing here choreographs anybody.
--
-- Which is why it adds no privacy surface at all. The view of a shared session
-- is a filter over `live_sessions` — the same presence rows, restricted to the
-- people in the same container. It cannot show more than presence already shows,
-- because there is nothing else to show: no weight column exists to join to.
--
-- Replayed on every cold start like every other migration, so every statement is
-- guarded and a partial run can simply be repeated.

-- One container, always born from a friendship.
--
-- Scoped to a link rather than standing free, so "who may join this" is already
-- answered by the friendship — no separate membership rule to get wrong, and no
-- id space to walk looking for open sessions.
CREATE TABLE IF NOT EXISTS shared_sessions (
  id SERIAL PRIMARY KEY,
  "linkId" INTEGER NOT NULL REFERENCES buddy_links(id) ON DELETE CASCADE,
  "createdByProfileId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Set when the last participant leaves. A closed session is never rejoined:
  -- the invite in the chat becomes a record of a session that happened, and
  -- training together tomorrow is a new one.
  "endedAt" TIMESTAMPTZ
);

-- At most one live container per friendship. Two people tapping "train
-- together" within the same second would otherwise land in two different
-- sessions and each see an empty one — the exact failure this feature exists to
-- avoid.
--
-- Partial, so the pair may train together again next week.
CREATE UNIQUE INDEX IF NOT EXISTS shared_sessions_live_link_idx
  ON shared_sessions("linkId") WHERE "endedAt" IS NULL;

CREATE TABLE IF NOT EXISTS shared_session_participants (
  "sessionId" INTEGER NOT NULL REFERENCES shared_sessions(id) ON DELETE CASCADE,
  "profileId" TEXT NOT NULL,
  "joinedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Nulled again on a rejoin rather than adding a second row: nobody asks how
  -- many times you stepped out, and a log here would be history nothing reads.
  "leftAt" TIMESTAMPTZ,
  PRIMARY KEY ("sessionId", "profileId")
);

-- Every read is "who is in this container", which the primary key already
-- covers. This one is the other direction: "which container am I in", asked
-- once per load and once per stream open.
CREATE INDEX IF NOT EXISTS shared_participants_profile_idx
  ON shared_session_participants("profileId") WHERE "leftAt" IS NULL;

-- Which container a live session belongs to, if any.
--
-- On `live_sessions` rather than derived from the participants table because
-- presence is what the client reads, and joining a second table on every poll to
-- learn something the presence row could carry itself would be work per tick for
-- no gain. Nullable: training alone is the ordinary case.
ALTER TABLE live_sessions
  ADD COLUMN IF NOT EXISTS "sharedSessionId" INTEGER;
