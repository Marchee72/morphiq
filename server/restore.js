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

async function restore() {
  const client = await pool.connect();
  try {
    const data = JSON.parse(readFileSync('/tmp/parse_clean_output.json', 'utf8'));
    
    await client.query('BEGIN');
    
    console.log('Deleting all existing fake data for other profiles...');
    // Delete all records of other profiles
    await client.query('DELETE FROM workout_sets WHERE "profileId" != \'1\'');
    await client.query('DELETE FROM workout_logs WHERE "profileId" != \'1\'');
    await client.query('DELETE FROM food_logs WHERE "profileId" != \'1\'');
    await client.query('DELETE FROM measurements WHERE "profileId" != \'1\'');
    await client.query('DELETE FROM messages WHERE "profileId" != \'1\'');
    await client.query('DELETE FROM user_exercises WHERE "profileId" != \'1\'');
    await client.query('DELETE FROM user_profiles WHERE id != 1');
    
    // Check if Lautaro profile (id = 1) exists. If not, restore it.
    const { rows: profileExists } = await client.query('SELECT 1 FROM user_profiles WHERE id = 1');
    if (profileExists.length === 0) {
      console.log('Restoring Lautaro profile...');
      const profiles = (data.user_profiles || []).filter(p => !p._is_deleted);
      const p = profiles[0] || (data.user_profiles || [])[0];
      if (p) {
        await client.query(
          `INSERT INTO user_profiles (id, name, gender, "birthDate", height, "targetWeight", "targetBodyFat", "createdAt", "trainingProfile") 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            p.id,
            cleanString(p.name),
            cleanString(p.gender),
            p.birthDate,
            p.height,
            p.targetWeight,
            p.targetBodyFat,
            p.createdAt,
            cleanString(p.trainingProfile)
          ]
        );
      }
      await client.query("SELECT setval('user_profiles_id_seq', COALESCE((SELECT MAX(id) FROM user_profiles), 1))");
    } else {
      console.log('Lautaro profile (id = 1) already exists. Keeping it to preserve current active workouts.');
    }
    
    console.log('Deleting existing measurements, messages, and exercises for Lautaro to prevent duplicates...');
    await client.query('DELETE FROM measurements WHERE "profileId" = \'1\'');
    await client.query('DELETE FROM messages WHERE "profileId" = \'1\'');
    await client.query('DELETE FROM user_exercises WHERE "profileId" = \'1\'');
    
    console.log('Restoring Lautaro measurements (filtering out anomalous weights)...');
    const measurements = data.measurements || [];
    let insertedMeasurements = 0;
    const seenMeasurementIds = new Set();
    // Sort so that active measurements (_is_deleted === false) are processed first
    measurements.sort((a, b) => (a._is_deleted ? 1 : 0) - (b._is_deleted ? 0 : 1));
    for (const m of measurements) {
      if (seenMeasurementIds.has(m.id)) continue;
      seenMeasurementIds.add(m.id);

      const weightVal = parseFloat(m.weight);
      if (isNaN(weightVal) || weightVal <= 10.0) {
        console.log(`Skipping invalid measurement ID ${m.id} (weight: ${m.weight})`);
        continue;
      }
      
      await client.query(
        `INSERT INTO measurements (id, "profileId", timestamp, weight, impedance, bmi, bmr, "bodyFat", "bodyWater", "boneMass", "muscleMass", "visceralFat", "metabolicAge", protein, "bodyType") 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          m.id,
          '1',
          m.timestamp,
          m.weight,
          m.impedance,
          m.bmi,
          m.bmr,
          m.bodyFat,
          m.bodyWater,
          m.boneMass,
          m.muscleMass,
          m.visceralFat,
          m.metabolicAge,
          m.protein,
          m.bodyType
        ]
      );
      insertedMeasurements++;
    }
    await client.query("SELECT setval('measurements_id_seq', COALESCE((SELECT MAX(id) FROM measurements), 1))");
    console.log(`Restored ${insertedMeasurements} measurements.`);
    
    console.log('Restoring Lautaro messages...');
    const messages = data.messages || [];
    let insertedMessages = 0;
    const seenMessageIds = new Set();
    messages.sort((a, b) => (a._is_deleted ? 1 : 0) - (b._is_deleted ? 0 : 1));
    for (const msg of messages) {
      if (seenMessageIds.has(msg.id)) continue;
      seenMessageIds.add(msg.id);

      await client.query(
        `INSERT INTO messages (id, "profileId", timestamp, sender, content) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          msg.id,
          '1',
          msg.timestamp,
          cleanString(msg.sender),
          cleanString(msg.content)
        ]
      );
      insertedMessages++;
    }
    await client.query("SELECT setval('messages_id_seq', COALESCE((SELECT MAX(id) FROM messages), 1))");
    console.log(`Restored ${insertedMessages} messages.`);
    
    console.log('Restoring Lautaro active user exercises...');
    const exercises = data.user_exercises || [];
    let insertedExercises = 0;
    const seenExerciseIds = new Set();
    exercises.sort((a, b) => (a._is_deleted ? 1 : 0) - (b._is_deleted ? 0 : 1));
    for (const ex of exercises) {
      if (seenExerciseIds.has(ex.id)) continue;
      seenExerciseIds.add(ex.id);

      if (ex._is_deleted) {
        continue;
      }
      await client.query(
        `INSERT INTO user_exercises (id, "profileId", name, "machineDetails", "lastUsed") 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          ex.id,
          '1',
          cleanString(ex.name),
          cleanString(ex.machineDetails),
          ex.lastUsed
        ]
      );
      insertedExercises++;
    }
    await client.query("SELECT setval('user_exercises_id_seq', COALESCE((SELECT MAX(id) FROM user_exercises), 1))");
    console.log(`Restored ${insertedExercises} active exercises.`);
    
    await client.query('COMMIT');
    console.log('🎉 DB Restore & Purge completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Restore failed, transaction rolled back:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

restore();
