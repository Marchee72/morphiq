-- The client's own name for a row, chosen before the row was ever sent.
--
-- Writes made offline are held in a queue on the device and replayed when the
-- connection comes back. A replay cannot tell "the request never arrived" from
-- "the request landed and the response never came back" — the two look
-- identical from a phone in a basement gym. Without a key the client picked
-- *before* sending, the second case files the workout twice.
--
-- That is not hypothetical here. `finishActiveSession` carries a comment about
-- sessions sitting in production logged three times over, from a retry path
-- that had no way to recognise its own earlier attempt. This column is how the
-- server recognises it instead.
--
-- NULL for every row that predates this and for every write that does not send
-- one, which is what makes the indexes below inert for existing traffic: SQL
-- UNIQUE treats NULLs as distinct, so any number of them coexist and the
-- ON CONFLICT clauses in the handlers simply never fire. An app version already
-- installed on someone's phone keeps working unchanged.
--
-- Replayed on every cold start like every other migration, so every statement
-- is guarded and a partial run can simply be repeated.

ALTER TABLE measurements      ADD COLUMN IF NOT EXISTS "clientId" TEXT;
ALTER TABLE food_logs         ADD COLUMN IF NOT EXISTS "clientId" TEXT;
ALTER TABLE workout_logs      ADD COLUMN IF NOT EXISTS "clientId" TEXT;
ALTER TABLE workout_sets      ADD COLUMN IF NOT EXISTS "clientId" TEXT;
ALTER TABLE routine_templates ADD COLUMN IF NOT EXISTS "clientId" TEXT;
ALTER TABLE messages          ADD COLUMN IF NOT EXISTS "clientId" TEXT;

-- Scoped to the profile rather than globally unique, for two reasons.
--
-- The first is authorization. A global index would match a clientId against
-- every row in the table, so a caller who guessed or replayed someone else's
-- key would get back that row's id — a probe for the existence of another
-- account's data through a column that looks like a write detail. Scoping it
-- means a key is only ever matched inside a profile the caller already proved
-- ownership of, via the `ownBody` guard every one of these routes carries.
--
-- The second is that "this profile's rows" is how all six of these tables are
-- queried anyway, so the index earns its keep twice.
CREATE UNIQUE INDEX IF NOT EXISTS measurements_client_idx      ON measurements("profileId", "clientId");
CREATE UNIQUE INDEX IF NOT EXISTS food_logs_client_idx         ON food_logs("profileId", "clientId");
CREATE UNIQUE INDEX IF NOT EXISTS workout_logs_client_idx      ON workout_logs("profileId", "clientId");
CREATE UNIQUE INDEX IF NOT EXISTS workout_sets_client_idx      ON workout_sets("profileId", "clientId");
CREATE UNIQUE INDEX IF NOT EXISTS routine_templates_client_idx ON routine_templates("profileId", "clientId");
CREATE UNIQUE INDEX IF NOT EXISTS messages_client_idx          ON messages("profileId", "clientId");

-- Two fields the client has always sent and this table has never had a column
-- for, so every set written in server mode has silently lost them since the day
-- server mode existed. `finishActiveSession` puts both on the wire; the INSERT
-- named neither.
--
-- Harmless while nothing read them back. It stops being harmless with an
-- offline cache: the row cached at write time carries the client's `isCompleted`,
-- the row that comes back after a sync does not, and the card visibly changes
-- underneath the user seconds after they finished their workout.
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS "isCompleted" BOOLEAN;
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS "biserieGroupId" TEXT;
