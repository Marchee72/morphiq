-- The profile fields the server never had columns for.
--
-- `UserProfile` grew four fields that only ever existed in IndexedDB. The client
-- has been sending all four on every save — it serialises the whole profile —
-- and Postgres has been dropping them on the floor, because neither the table
-- nor the INSERT/UPDATE column lists mention them.
--
-- The visible damage: on the web build your gym equipment and your weekly goal
-- reset every time the profile reloads, and the coach prompt reads
-- `availableEquipment`, so the coach has been prescribing barbell work to
-- somebody who told the app they only own dumbbells.
--
-- Found while adding `"sharePresence"` in 002, which would have joined them.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS "targetCalories" NUMERIC;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS "targetProtein" NUMERIC;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS "weeklyWorkoutGoalDays" INTEGER;

-- JSONB rather than TEXT[], matching `routine_templates."targetMuscles"`: the
-- client sends and receives it as a JSON array and never queries inside it.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS "availableEquipment" JSONB;
