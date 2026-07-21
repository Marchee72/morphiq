-- MorphIQ PostgreSQL Schema (aligned with TypeScript entity field names)

CREATE TABLE IF NOT EXISTS user_profiles (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  gender TEXT NOT NULL,
  "birthDate" TIMESTAMPTZ NOT NULL,
  height NUMERIC NOT NULL,
  "targetWeight" NUMERIC,
  "targetBodyFat" NUMERIC,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS measurements (
  id SERIAL PRIMARY KEY,
  "profileId" TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  weight NUMERIC,
  impedance NUMERIC,
  bmi NUMERIC,
  bmr NUMERIC,
  "bodyFat" NUMERIC,
  "bodyWater" NUMERIC,
  "boneMass" NUMERIC,
  "muscleMass" NUMERIC,
  "visceralFat" NUMERIC,
  "metabolicAge" NUMERIC,
  protein NUMERIC,
  "bodyType" NUMERIC
);

CREATE TABLE IF NOT EXISTS food_logs (
  id SERIAL PRIMARY KEY,
  "profileId" TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "mealType" TEXT,
  description TEXT NOT NULL,
  calories NUMERIC,
  protein NUMERIC,
  carbs NUMERIC,
  fat NUMERIC
);

CREATE TABLE IF NOT EXISTS workout_logs (
  id SERIAL PRIMARY KEY,
  "profileId" TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  duration NUMERIC,
  "caloriesBurned" NUMERIC,
  "distanceKm" NUMERIC,
  "avgHeartRate" NUMERIC,
  "maxHeartRate" NUMERIC,
  "source" TEXT DEFAULT 'manual',
  "externalId" TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  "profileId" TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sender TEXT NOT NULL,
  content TEXT NOT NULL
);

-- Migrations/Alterations for existing tables:
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS "distanceKm" NUMERIC;
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS "avgHeartRate" NUMERIC;
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS "maxHeartRate" NUMERIC;
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'manual';
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS "externalId" TEXT;

CREATE TABLE IF NOT EXISTS workout_sets (
  id SERIAL PRIMARY KEY,
  "workoutLogId" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "exerciseName" TEXT NOT NULL,
  "setNumber" INT NOT NULL,
  reps NUMERIC NOT NULL,
  weight NUMERIC NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- Migrations/Alterations for existing tables:
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS "distanceKm" NUMERIC;
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS "avgHeartRate" NUMERIC;
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS "maxHeartRate" NUMERIC;
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT 'manual';
ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS "trainingProfile" TEXT;
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS "notes" TEXT;

CREATE TABLE IF NOT EXISTS user_exercises (
  id SERIAL PRIMARY KEY,
  "profileId" TEXT NOT NULL,
  name TEXT NOT NULL,
  "machineDetails" TEXT,
  "lastUsed" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alter workout_sets table for nullable reps/weight and optional cardio fields:
ALTER TABLE workout_sets ALTER COLUMN reps DROP NOT NULL;
ALTER TABLE workout_sets ALTER COLUMN weight DROP NOT NULL;
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS "distanceKm" NUMERIC;
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS "duration" NUMERIC;
ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS "speed" NUMERIC;

-- Alter user_profiles table for soft delete / logical delete support:
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS exercise_favorites (
  id SERIAL PRIMARY KEY,
  "profileId" TEXT NOT NULL,
  "exerciseId" TEXT NOT NULL,
  "addedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("profileId", "exerciseId")
);

ALTER TABLE workout_sets ADD COLUMN IF NOT EXISTS "exerciseId" TEXT;

