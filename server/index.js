import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { readFileSync, appendFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Logging Utility ─────────────────────────────────────────────────────────
const LOG_FILE = join(__dirname, 'app.log');

function logToFile(level, message, stack = null, context = null) {
  const timestamp = new Date().toISOString();
  let logText = `[${timestamp}] [${level}] ${message}\n`;
  if (stack) {
    logText += `Stack: ${stack}\n`;
  }
  if (context) {
    logText += `Context: ${JSON.stringify(context)}\n`;
  }
  logText += '--------------------------------------------------------------------------------\n';
  try {
    appendFileSync(LOG_FILE, logText);
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

// ─── Database Connection ───────────────────────────────────────────────────────
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'morphiq',
  user: process.env.DB_USER || 'morphiq',
  password: process.env.DB_PASSWORD || 'morphiq_secret_2024',
});

async function initDb() {
  try {
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('✅ Database schema verified/applied.');
  } catch (err) {
    logToFile('DATABASE_INIT_ERROR', err.message, err.stack);
    throw err;
  }
}

// ─── Express Setup ────────────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// ─── Remote Client Logging Endpoint ──────────────────────────────────────────
app.post('/api/logs', (req, res) => {
  const { level, message, stack, context } = req.body;
  logToFile(level || 'CLIENT_ERROR', message || '', stack, context);
  res.status(204).end();
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Helper: parse numeric nulls from pg ─────────────────────────────────────
const num = (v) => (v != null ? parseFloat(v) : undefined);

// ─── User Profiles ────────────────────────────────────────────────────────────
app.get('/api/profiles', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM user_profiles WHERE is_deleted = false OR is_deleted IS NULL ORDER BY "createdAt" ASC');
    res.json(rows.map(r => ({ ...r, id: r.id.toString(), height: num(r.height) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/profiles/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM user_profiles WHERE id = $1 AND (is_deleted = false OR is_deleted IS NULL)', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const r = rows[0];
    res.json({ ...r, id: r.id.toString(), height: num(r.height) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/profiles', async (req, res) => {
  const p = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO user_profiles (name, gender, "birthDate", height, "targetWeight", "targetBodyFat", "createdAt", "trainingProfile")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [p.name, p.gender, p.birthDate, p.height, p.targetWeight, p.targetBodyFat, p.createdAt || new Date(), p.trainingProfile]
    );
    const r = rows[0];
    res.status(201).json({ ...r, id: r.id.toString(), height: num(r.height) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/profiles/:id', async (req, res) => {
  const p = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE user_profiles SET name=$1, gender=$2, "birthDate"=$3, height=$4, "targetWeight"=$5, "targetBodyFat"=$6, "trainingProfile"=$7
       WHERE id=$8 AND (is_deleted = false OR is_deleted IS NULL) RETURNING *`,
      [p.name, p.gender, p.birthDate, p.height, p.targetWeight, p.targetBodyFat, p.trainingProfile, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const r = rows[0];
    res.json({ ...r, id: r.id.toString(), height: num(r.height) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/profiles/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('UPDATE user_profiles SET is_deleted = true WHERE id = $1 RETURNING *', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Profile not found' });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/profiles/:id/restore', async (req, res) => {
  try {
    const { rows } = await pool.query('UPDATE user_profiles SET is_deleted = false WHERE id = $1 RETURNING *', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Profile not found' });
    const r = rows[0];
    res.json({ ...r, id: r.id.toString(), height: num(r.height) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Measurements ─────────────────────────────────────────────────────────────
app.get('/api/profiles/:id/measurements', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM measurements WHERE "profileId" = $1 ORDER BY timestamp ASC',
      [req.params.id]
    );
    res.json(rows.map(r => ({
      ...r, id: r.id.toString(),
      weight: num(r.weight), impedance: num(r.impedance), bmi: num(r.bmi),
      bmr: num(r.bmr), bodyFat: num(r.bodyFat), bodyWater: num(r.bodyWater),
      boneMass: num(r.boneMass), muscleMass: num(r.muscleMass),
      visceralFat: num(r.visceralFat), metabolicAge: num(r.metabolicAge),
      protein: num(r.protein), bodyType: num(r.bodyType),
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/measurements', async (req, res) => {
  const m = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO measurements ("profileId", timestamp, weight, impedance, bmi, bmr,
        "bodyFat", "bodyWater", "boneMass", "muscleMass", "visceralFat", "metabolicAge", protein, "bodyType")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [m.profileId, m.timestamp || new Date(), m.weight, m.impedance, m.bmi, m.bmr,
       m.bodyFat, m.bodyWater, m.boneMass, m.muscleMass, m.visceralFat, m.metabolicAge,
       m.protein, m.bodyType]
    );
    const r = rows[0];
    res.status(201).json({ ...r, id: r.id.toString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/measurements/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM measurements WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Food Logs ────────────────────────────────────────────────────────────────
app.get('/api/profiles/:id/food-logs', async (req, res) => {
  try {
    let query = 'SELECT * FROM food_logs WHERE "profileId" = $1';
    const params = [req.params.id];
    if (req.query.date) {
      query += ' AND DATE(timestamp) = DATE($2)';
      params.push(req.query.date);
    } else if (req.query.startDate && req.query.endDate) {
      query += ' AND timestamp >= $2 AND timestamp <= $3';
      params.push(req.query.startDate, req.query.endDate);
    }
    query += ' ORDER BY timestamp ASC';
    const { rows } = await pool.query(query, params);
    res.json(rows.map(r => ({
      ...r, id: r.id.toString(),
      calories: num(r.calories), protein: num(r.protein), carbs: num(r.carbs), fat: num(r.fat),
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/food-logs', async (req, res) => {
  const f = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO food_logs ("profileId", timestamp, "mealType", description, calories, protein, carbs, fat)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [f.profileId, f.timestamp || new Date(), f.mealType, f.description, f.calories, f.protein, f.carbs, f.fat]
    );
    const r = rows[0];
    res.status(201).json({ ...r, id: r.id.toString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/food-logs/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM food_logs WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Workout Logs ─────────────────────────────────────────────────────────────
app.get('/api/profiles/:id/workout-logs', async (req, res) => {
  try {
    let query = 'SELECT * FROM workout_logs WHERE "profileId" = $1';
    const params = [req.params.id];
    
    if (req.query.date) {
      query += ' AND DATE(timestamp) = DATE($2)';
      params.push(req.query.date);
    } else if (req.query.startDate && req.query.endDate) {
      query += ' AND timestamp >= $2 AND timestamp <= $3';
      params.push(req.query.startDate, req.query.endDate);
    }
    
    query += ' ORDER BY timestamp ASC';
    const { rows } = await pool.query(query, params);
    res.json(rows.map(r => ({
      ...r,
      id: r.id.toString(),
      duration: num(r.duration),
      caloriesBurned: num(r.caloriesBurned),
      distanceKm: num(r.distanceKm),
      avgHeartRate: num(r.avgHeartRate),
      maxHeartRate: num(r.maxHeartRate)
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/workout-logs', async (req, res) => {
  const w = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO workout_logs ("profileId", timestamp, type, description, duration, "caloriesBurned", "distanceKm", "avgHeartRate", "maxHeartRate", "source", "externalId")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        w.profileId,
        w.timestamp || new Date(),
        w.type,
        w.description,
        w.duration,
        w.caloriesBurned,
        w.distanceKm,
        w.avgHeartRate,
        w.maxHeartRate,
        w.source || 'manual',
        w.externalId
      ]
    );
    const r = rows[0];
    res.status(201).json({
      ...r,
      id: r.id.toString(),
      duration: num(r.duration),
      caloriesBurned: num(r.caloriesBurned),
      distanceKm: num(r.distanceKm),
      avgHeartRate: num(r.avgHeartRate),
      maxHeartRate: num(r.maxHeartRate)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/workout-logs/:id', async (req, res) => {
  const w = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE workout_logs 
       SET "profileId" = $1, timestamp = $2, type = $3, description = $4, duration = $5, 
           "caloriesBurned" = $6, "distanceKm" = $7, "avgHeartRate" = $8, "maxHeartRate" = $9, 
           "source" = $10, "externalId" = $11
       WHERE id = $12 RETURNING *`,
      [
        w.profileId,
        w.timestamp,
        w.type,
        w.description,
        w.duration,
        w.caloriesBurned,
        w.distanceKm,
        w.avgHeartRate,
        w.maxHeartRate,
        w.source || 'manual',
        w.externalId,
        req.params.id
      ]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Workout log not found' });
    }
    const r = rows[0];
    res.json({
      ...r,
      id: r.id.toString(),
      duration: num(r.duration),
      caloriesBurned: num(r.caloriesBurned),
      distanceKm: num(r.distanceKm),
      avgHeartRate: num(r.avgHeartRate),
      maxHeartRate: num(r.maxHeartRate)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/workout-logs/:id', async (req, res) => {
  try {
    await pool.query('BEGIN');
    await pool.query('DELETE FROM workout_sets WHERE "workoutLogId" = $1', [req.params.id]);
    await pool.query('DELETE FROM workout_logs WHERE id = $1', [req.params.id]);
    await pool.query('COMMIT');
    res.status(204).end();
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// ─── Messages ─────────────────────────────────────────────────────────────────
app.get('/api/profiles/:id/messages', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM messages WHERE "profileId" = $1 ORDER BY timestamp ASC',
      [req.params.id]
    );
    res.json(rows.map(r => ({ ...r, id: r.id.toString() })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/messages', async (req, res) => {
  const msg = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO messages ("profileId", timestamp, sender, content)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [msg.profileId, msg.timestamp || new Date(), msg.sender, msg.content]
    );
    const r = rows[0];
    res.status(201).json({ ...r, id: r.id.toString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/profiles/:id/messages', async (req, res) => {
  try {
    await pool.query('DELETE FROM messages WHERE "profileId" = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Workout Sets ─────────────────────────────────────────────────────────────
app.post('/api/workout-sets', async (req, res) => {
  const s = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO workout_sets ("workoutLogId", "profileId", "exerciseName", "setNumber", reps, weight, timestamp, notes, "distanceKm", "duration", "speed")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [s.workoutLogId, s.profileId, s.exerciseName, s.setNumber, s.reps, s.weight, s.timestamp || new Date(), s.notes, s.distanceKm, s.duration, s.speed]
    );
    const r = rows[0];
    res.status(201).json({
      ...r,
      id: r.id.toString(),
      reps: num(r.reps),
      weight: num(r.weight),
      distanceKm: num(r.distanceKm),
      duration: num(r.duration),
      speed: num(r.speed)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/workout-sets/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM workout_sets WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/workouts/:workoutLogId/sets', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM workout_sets WHERE "workoutLogId" = $1 ORDER BY "setNumber" ASC',
      [req.params.workoutLogId]
    );
    res.json(rows.map(r => ({
      ...r,
      id: r.id.toString(),
      reps: num(r.reps),
      weight: num(r.weight),
      distanceKm: num(r.distanceKm),
      duration: num(r.duration),
      speed: num(r.speed)
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/profiles/:profileId/exercises/sets', async (req, res) => {
  try {
    const exerciseName = req.query.name;
    if (!exerciseName) {
      return res.status(400).json({ error: 'Missing name query parameter' });
    }
    const { rows } = await pool.query(
      'SELECT * FROM workout_sets WHERE "profileId" = $1 AND LOWER("exerciseName") = LOWER($2) ORDER BY timestamp DESC',
      [req.params.profileId, exerciseName]
    );
    res.json(rows.map(r => ({
      ...r,
      id: r.id.toString(),
      reps: num(r.reps),
      weight: num(r.weight),
      distanceKm: num(r.distanceKm),
      duration: num(r.duration),
      speed: num(r.speed)
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/profiles/:profileId/exercises', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM user_exercises WHERE "profileId" = $1 ORDER BY "lastUsed" DESC',
      [req.params.profileId]
    );
    res.json(rows.map(r => ({ ...r, id: r.id.toString() })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/exercises', async (req, res) => {
  const e = req.body;
  try {
    // Check if already exists for this profile
    const { rows: existing } = await pool.query(
      'SELECT id FROM user_exercises WHERE "profileId" = $1 AND LOWER(name) = LOWER($2)',
      [e.profileId, e.name]
    );
    if (existing.length > 0) {
      const id = existing[0].id;
      const { rows } = await pool.query(
        `UPDATE user_exercises SET "machineDetails"=$1, "lastUsed"=$2
         WHERE id=$3 RETURNING *`,
        [e.machineDetails, e.lastUsed || new Date(), id]
      );
      res.json({ ...rows[0], id: rows[0].id.toString() });
    } else {
      const { rows } = await pool.query(
        `INSERT INTO user_exercises ("profileId", name, "machineDetails", "lastUsed")
         VALUES ($1,$2,$3,$4) RETURNING *`,
        [e.profileId, e.name, e.machineDetails, e.lastUsed || new Date()]
      );
      res.status(201).json({ ...rows[0], id: rows[0].id.toString() });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/exercises/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM user_exercises WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/workouts/:workoutLogId/sets', async (req, res) => {
  try {
    await pool.query('DELETE FROM workout_sets WHERE "workoutLogId" = $1', [req.params.workoutLogId]);
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Exercise Favorites ───────────────────────────────────────────────────────
app.get('/api/profiles/:profileId/exercise-favorites', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM exercise_favorites WHERE "profileId" = $1 ORDER BY "addedAt" DESC',
      [req.params.profileId]
    );
    res.json(rows.map(r => ({ ...r, id: r.id.toString(), addedAt: r.addedAt })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/exercise-favorites', async (req, res) => {
  const f = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO exercise_favorites ("profileId", "exerciseId", "addedAt")
       VALUES ($1, $2, $3)
       ON CONFLICT ("profileId", "exerciseId") DO NOTHING
       RETURNING *`,
      [f.profileId, f.exerciseId, f.addedAt || new Date()]
    );
    if (rows.length > 0) {
      res.status(201).json({ ...rows[0], id: rows[0].id.toString(), addedAt: rows[0].addedAt });
    } else {
      const { rows: existing } = await pool.query(
        'SELECT * FROM exercise_favorites WHERE "profileId" = $1 AND "exerciseId" = $2',
        [f.profileId, f.exerciseId]
      );
      res.status(200).json({ ...existing[0], id: existing[0].id.toString(), addedAt: existing[0].addedAt });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/exercise-favorites', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM exercise_favorites WHERE "profileId" = $1 AND "exerciseId" = $2',
      [req.query.profileId, req.query.exerciseId]
    );
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Error Handling Middleware ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logToFile('SERVER_ERROR', err.message, err.stack, { url: req.url, method: req.method });
  res.status(500).json({ error: 'Internal Server Error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
initDb()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 MorphIQ API server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to initialize database:', err);
    process.exit(1);
  });
