-- Messages between training partners.
--
-- Deliberately not the existing `messages` table: that one is the AI coach
-- thread, scoped by a single `"profileId"`, with no notion of two parties or of
-- who sent what. Sharing it would mean every read of either had to remember
-- which kind of conversation it was looking at.
--
-- Replayed on every cold start like every other migration, so every statement is
-- guarded and a partial run can simply be repeated.

CREATE TABLE IF NOT EXISTS buddy_messages (
  id SERIAL PRIMARY KEY,
  "linkId" INTEGER NOT NULL REFERENCES buddy_links(id) ON DELETE CASCADE,
  "senderProfileId" TEXT NOT NULL,
  -- 'text' today. 'routine' and 'sessionInvite' arrive with their own stages;
  -- the column exists now so those are an added case rather than a migration.
  kind TEXT NOT NULL DEFAULT 'text',
  body TEXT,
  payload JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exactly what every read does: `WHERE "linkId" = $1 AND id > $2`, both for
-- paging and for the cleared-before cursor.
CREATE INDEX IF NOT EXISTS buddy_messages_link_id_idx ON buddy_messages("linkId", id);

-- ─── Per-side read and clear cursors ────────────────────────────────────────
--
-- One row per person per conversation. Two cursors, doing different jobs:
--
-- `"lastReadMessageId"` is the unread badge.
--
-- `"clearedBeforeMessageId"` is how "removing a partner deletes only your copy"
-- is actually implemented. Leaving sets it to the last message in the
-- conversation, and every read filters below it. A flag per message would need
-- a column per side on every row to say the same thing, and would have to be
-- backfilled across the whole conversation at the moment of leaving.
--
-- It also survives a revival on purpose. If the two later reconnect with a new
-- code the link comes back, but the cursor stays where it was, so the
-- conversation you deleted does not reappear underneath the new one.
CREATE TABLE IF NOT EXISTS buddy_read_marks (
  "linkId" INTEGER NOT NULL REFERENCES buddy_links(id) ON DELETE CASCADE,
  "profileId" TEXT NOT NULL,
  "lastReadMessageId" INTEGER NOT NULL DEFAULT 0,
  "clearedBeforeMessageId" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("linkId", "profileId")
);

ALTER TABLE buddy_read_marks
  ADD COLUMN IF NOT EXISTS "clearedBeforeMessageId" INTEGER NOT NULL DEFAULT 0;
