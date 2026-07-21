import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'fs';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'morphiq',
  user: process.env.DB_USER || 'morphiq',
  password: process.env.DB_PASSWORD || 'morphiq_secret_2024',
});

// Clean strings from null characters
function cleanString(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/\0/g, '').trim();
}

async function restoreWorkouts() {
  const client = await pool.connect();
  try {
    const data = JSON.parse(readFileSync('/tmp/parse_clean_output.json', 'utf8'));
    
    await client.query('BEGIN');
    
    // 1. Restore missing workout_logs
    const parsedLogs = data.workout_logs || [];
    console.log(`Parsed ${parsedLogs.length} workout logs from file.`);
    
    // Get existing logs in DB
    const { rows: existingLogs } = await client.query('SELECT id FROM workout_logs');
    const existingLogIds = new Set(existingLogs.map(l => l.id));
    
    let insertedLogs = 0;
    for (const log of parsedLogs) {
      if (existingLogIds.has(log.id)) {
        continue;
      }
      
      await client.query(
        `INSERT INTO workout_logs (id, "profileId", timestamp, type, description, duration, "caloriesBurned", "distanceKm", "avgHeartRate", "maxHeartRate", source, "externalId")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          log.id,
          '1',
          log.timestamp,
          cleanString(log.type),
          cleanString(log.description),
          log.duration,
          log.caloriesBurned,
          log.distanceKm,
          log.avgHeartRate,
          log.maxHeartRate,
          cleanString(log.source),
          cleanString(log.externalId)
        ]
      );
      insertedLogs++;
    }
    console.log(`Restored ${insertedLogs} missing workout logs.`);
    await client.query("SELECT setval('workout_logs_id_seq', COALESCE((SELECT MAX(id) FROM workout_logs), 1))");

    // 2. Restore workout_sets
    // Since we verified workout_sets is currently empty in the DB for profile 1,
    // let's clear whatever might be in there for profile 1 (just to be safe) and insert all 63.
    await client.query('DELETE FROM workout_sets WHERE "profileId" = \'1\'');
    
    const parsedSets = data.workout_sets || [];
    console.log(`Parsed ${parsedSets.length} workout sets from file.`);
    
    let insertedSets = 0;
    for (const s of parsedSets) {
      await client.query(
        `INSERT INTO workout_sets (id, "workoutLogId", "profileId", "exerciseName", "setNumber", reps, weight, timestamp, notes, "distanceKm", duration, speed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          s.id,
          cleanString(s.workoutLogId),
          '1',
          cleanString(s.exerciseName),
          s.setNumber,
          s.reps,
          s.weight,
          s.timestamp,
          cleanString(s.notes),
          s.distanceKm,
          s.duration,
          s.speed
        ]
      );
      insertedSets++;
    }
    console.log(`Restored ${insertedSets} workout sets.`);
    await client.query("SELECT setval('workout_sets_id_seq', COALESCE((SELECT MAX(id) FROM workout_sets), 1))");
    
    await client.query('COMMIT');
    console.log('🎉 Workout data recovery completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Workout restore failed, transaction rolled back:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

restoreWorkouts();
