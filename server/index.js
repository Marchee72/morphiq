import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { readFileSync, appendFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  authRequired, authenticate, verifyGoogleToken, upsertUser, issueSession,
  adoptOrphanProfiles, guardProfile, guardBodyProfile, guardQueryProfile,
  guardRow, guardWorkoutSets, requireUser,
} from './auth.js';
import { socialRoutes } from './social.js';

const { Pool } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: join(__dirname, '.env') });
dotenv.config();

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
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('sslmode=require') || process.env.DATABASE_URL.includes('neon.tech')
        ? { rejectUnauthorized: false }
        : undefined,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'morphiq',
      user: process.env.DB_USER || 'morphiq',
      password: process.env.DB_PASSWORD || 'morphiq_secret_2024',
    };

const pool = new Pool(poolConfig);

async function initDb() {
  try {
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);

    // Migrations are additive and individually guarded, so replaying them is
    // safe — which matters on serverless, where this can run on any cold start.
    const migrationsDir = join(__dirname, 'migrations');
    if (existsSync(migrationsDir)) {
      for (const file of readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()) {
        await pool.query(readFileSync(join(migrationsDir, file), 'utf8'));
        console.log(`✅ Migration applied: ${file}`);
      }
    }
    console.log('✅ Database schema verified/applied.');
  } catch (err) {
    logToFile('DATABASE_INIT_ERROR', err.message, err.stack);
    throw err;
  }
}

// ─── Express Setup ────────────────────────────────────────────────────────────
const app = express();

// An allow-list, not `*`. The Capacitor WebView reports its origin as
// http(s)://localhost, and requests with no Origin header at all (curl, native
// HTTP clients) are still allowed — the session token is what protects the data,
// CORS only stops a hostile web page from riding along with it.
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  // `vite preview`, which is how the production bundle gets checked before it
  // ships. Without it the built app cannot reach the API at all, and the sign-in
  // wall correctly but unhelpfully reports the server as unreachable.
  'http://localhost:4173',
  'http://localhost',
  'https://localhost',
  'capacitor://localhost',
  'https://morphiq-eight.vercel.app',
];

app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`Origin not allowed: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json());

/**
 * No cache may keep an API response. Not the browser's disk, not a CDN.
 *
 * Every one of these carries one account's profiles, sessions or measurements,
 * and the platform default is `public, max-age=0, must-revalidate` with a `Vary`
 * of `Origin` alone. `public` invites shared caches to store it, and leaving
 * `Authorization` out of `Vary` means two accounts on the same origin key to the
 * same entry. `must-revalidate` keeps that from becoming a leak in practice, but
 * the correct answer for authenticated data is not to store it at all — which
 * also stops per-account JSON sitting on the disk of a shared phone.
 *
 * The service worker refuses `/api/` for the same reason; this closes the half
 * of the problem a service worker cannot reach.
 */
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// ─── Authentication ───────────────────────────────────────────────────────────

/**
 * Exchanges a Google ID token for an app session.
 *
 * Deliberately mounted before `authenticate`: signing in cannot itself require
 * being signed in.
 */
app.post('/api/auth/google', async (req, res) => {
  try {
    const { idToken } = req.body ?? {};
    if (!idToken) return res.status(400).json({ error: 'Missing idToken' });

    const payload = await verifyGoogleToken(idToken);
    const user = await upsertUser(pool, payload);
    const adopted = await adoptOrphanProfiles(pool, user.id, payload.email);

    res.json({
      token: issueSession(user),
      user: { id: user.id, email: user.email, name: user.name, picture: user.picture },
      adoptedProfiles: adopted,
    });
  } catch (err) {
    logToFile('AUTH_ERROR', err.message, err.stack);
    res.status(401).json({ error: 'Could not verify that sign-in' });
  }
});

/** Who the current session belongs to, and whether auth is being enforced yet. */
app.get('/api/auth/me', authenticate(pool), (req, res) => {
  res.json({
    authRequired,
    user: req.user
      ? { id: req.user.id, email: req.user.email, name: req.user.name, picture: req.user.picture }
      : null,
  });
});

// ─── Remote Client Logging Endpoint ──────────────────────────────────────────
app.post('/api/logs', (req, res) => {
  const { level, message, stack, context } = req.body;
  logToFile(level || 'CLIENT_ERROR', message || '', stack, context);
  res.status(204).end();
});

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), authRequired });
});

// From here down every route requires a session (once AUTH_REQUIRED is on), and
// anything addressing a specific profile also has to belong to the caller.
//
// The path guard covers only `/api/profiles/:id/...`. It is not enough on its
// own: most writes name their profile in the body, and every delete addresses a
// row by its own id, so each of those routes carries its own guard below.
// Without them a signed-in user could still read and delete another user's sets,
// measurements and routines by walking the id space.
app.use('/api', authenticate(pool));
app.use('/api/profiles/:profileId', guardProfile(pool));

/** Writes whose profile is named in the body. */
const ownBody = guardBodyProfile(pool);

// The only routes where one account can see anything belonging to another, so
// they are closed to anonymous callers whatever `AUTH_REQUIRED` says — the
// staged rollout has no older client to protect here.
app.use('/api/social', requireUser, socialRoutes(pool));

// ─── Helper: parse numeric nulls from pg ─────────────────────────────────────
const num = (v) => (v != null ? parseFloat(v) : undefined);

// ─── User Profiles ────────────────────────────────────────────────────────────
app.get('/api/profiles', async (req, res) => {
  try {
    const live = '(is_deleted = false OR is_deleted IS NULL)';
    const { rows } = req.user
      ? await pool.query(
          `SELECT * FROM user_profiles WHERE ${live} AND user_id = $1 ORDER BY "createdAt" ASC`,
          [req.user.id],
        )
      // Only reachable while AUTH_REQUIRED is off, during the rollout.
      : await pool.query(`SELECT * FROM user_profiles WHERE ${live} ORDER BY "createdAt" ASC`);
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
      `INSERT INTO user_profiles (name, gender, "birthDate", height, "targetWeight", "targetBodyFat", "createdAt", "trainingProfile", user_id,
                                 "targetCalories", "targetProtein", "weeklyWorkoutGoalDays", "availableEquipment", "sharePresence")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [p.name, p.gender, p.birthDate, p.height, p.targetWeight, p.targetBodyFat, p.createdAt || new Date(), p.trainingProfile, req.user?.id ?? null,
       p.targetCalories, p.targetProtein, p.weeklyWorkoutGoalDays,
       p.availableEquipment ? JSON.stringify(p.availableEquipment) : null,
       p.sharePresence ?? true]
    );
    const r = rows[0];
    res.status(201).json({ ...r, id: r.id.toString(), height: num(r.height) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/profiles/:id', async (req, res) => {
  const p = req.body;
  try {
    const { rows } = await pool.query(
      // Every column the client can edit has to be named here. Four of them were
      // missing until now, so equipment and the weekly goal were silently
      // discarded on every save in server mode — see migration 003.
      `UPDATE user_profiles SET name=$1, gender=$2, "birthDate"=$3, height=$4, "targetWeight"=$5, "targetBodyFat"=$6, "trainingProfile"=$7,
              "targetCalories"=$9, "targetProtein"=$10, "weeklyWorkoutGoalDays"=$11, "availableEquipment"=$12, "sharePresence"=$13
       WHERE id=$8 AND (is_deleted = false OR is_deleted IS NULL) RETURNING *`,
      [p.name, p.gender, p.birthDate, p.height, p.targetWeight, p.targetBodyFat, p.trainingProfile, req.params.id,
       p.targetCalories, p.targetProtein, p.weeklyWorkoutGoalDays,
       p.availableEquipment ? JSON.stringify(p.availableEquipment) : null,
       p.sharePresence ?? true]
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

/**
 * What to do when a write arrives twice.
 *
 * Every insert below that a phone can replay carries a `"clientId"` the client
 * chose before sending — see migration 008. This clause is what makes the
 * second arrival a no-op instead of a duplicate row.
 *
 * `DO UPDATE` rather than `DO NOTHING`, and the assignment is deliberately
 * pointless. `DO NOTHING` returns no row, so `RETURNING *` yields nothing and
 * the handler answers with an undefined id — but a replaying client is asking
 * precisely because it does not know the row's id yet. Re-assigning the column
 * to the value it already has is the cheapest way to make `RETURNING` fire.
 *
 * Writes without a `clientId` — every app version already installed, and every
 * server-side path — insert a NULL, which no unique index ever conflicts on, so
 * this clause never fires for them.
 */
const ON_CLIENT_ID_CONFLICT =
  'ON CONFLICT ("profileId", "clientId") DO UPDATE SET "clientId" = EXCLUDED."clientId"';

// ─── Measurements ─────────────────────────────────────────────────────────────
app.get('/api/profiles/:id/measurements', async (req, res) => {
  try {
    // Columns, not `*`: visceral fat, metabolic age, protein and body type were
    // dropped from the model, and a stray `*` would put them back on the wire.
    const { rows } = await pool.query(
      `SELECT id, "profileId", timestamp, weight, impedance, bmi, bmr,
              "bodyFat", "bodyWater", "boneMass", "muscleMass"
         FROM measurements WHERE "profileId" = $1 ORDER BY timestamp ASC`,
      [req.params.id]
    );
    res.json(rows.map(r => ({
      ...r, id: r.id.toString(),
      weight: num(r.weight), impedance: num(r.impedance), bmi: num(r.bmi),
      bmr: num(r.bmr), bodyFat: num(r.bodyFat), bodyWater: num(r.bodyWater),
      boneMass: num(r.boneMass), muscleMass: num(r.muscleMass),
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/measurements', ownBody, async (req, res) => {
  const m = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO measurements ("profileId", timestamp, weight, impedance, bmi, bmr,
        "bodyFat", "bodyWater", "boneMass", "muscleMass", "clientId")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ${ON_CLIENT_ID_CONFLICT} RETURNING *`,
      [m.profileId, m.timestamp || new Date(), m.weight, m.impedance, m.bmi, m.bmr,
       m.bodyFat, m.bodyWater, m.boneMass, m.muscleMass, m.clientId ?? null]
    );
    const r = rows[0];
    res.status(201).json({ ...r, id: r.id.toString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/measurements/:id', guardRow(pool, 'measurements'), async (req, res) => {
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

app.post('/api/food-logs', ownBody, async (req, res) => {
  const f = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO food_logs ("profileId", timestamp, "mealType", description, calories, protein, carbs, fat, "clientId")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ${ON_CLIENT_ID_CONFLICT} RETURNING *`,
      [f.profileId, f.timestamp || new Date(), f.mealType, f.description, f.calories, f.protein, f.carbs, f.fat, f.clientId ?? null]
    );
    const r = rows[0];
    res.status(201).json({ ...r, id: r.id.toString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/food-logs/:id', guardRow(pool, 'food_logs'), async (req, res) => {
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
      steps: num(r.steps),
      avgHeartRate: num(r.avgHeartRate),
      maxHeartRate: num(r.maxHeartRate)
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/workout-logs', ownBody, async (req, res) => {
  const w = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO workout_logs ("profileId", timestamp, type, description, duration, "caloriesBurned", "distanceKm", steps, "avgHeartRate", "maxHeartRate", "source", "externalId", "clientId")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ${ON_CLIENT_ID_CONFLICT} RETURNING *`,
      [
        w.profileId,
        w.timestamp || new Date(),
        w.type,
        w.description,
        w.duration,
        w.caloriesBurned,
        w.distanceKm,
        w.steps,
        w.avgHeartRate,
        w.maxHeartRate,
        w.source || 'manual',
        w.externalId,
        w.clientId ?? null
      ]
    );
    const r = rows[0];
    res.status(201).json({
      ...r,
      id: r.id.toString(),
      duration: num(r.duration),
      caloriesBurned: num(r.caloriesBurned),
      distanceKm: num(r.distanceKm),
      steps: num(r.steps),
      avgHeartRate: num(r.avgHeartRate),
      maxHeartRate: num(r.maxHeartRate)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/workout-logs/:id', guardRow(pool, 'workout_logs'), ownBody, async (req, res) => {
  const w = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE workout_logs 
       SET "profileId" = $1, timestamp = $2, type = $3, description = $4, duration = $5,
           "caloriesBurned" = $6, "distanceKm" = $7, steps = $8, "avgHeartRate" = $9, "maxHeartRate" = $10,
           "source" = $11, "externalId" = $12
       WHERE id = $13 RETURNING *`,
      [
        w.profileId,
        w.timestamp,
        w.type,
        w.description,
        w.duration,
        w.caloriesBurned,
        w.distanceKm,
        w.steps,
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
      steps: num(r.steps),
      avgHeartRate: num(r.avgHeartRate),
      maxHeartRate: num(r.maxHeartRate)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/workout-logs/:id', guardRow(pool, 'workout_logs'), async (req, res) => {
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

app.post('/api/messages', ownBody, async (req, res) => {
  const msg = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO messages ("profileId", timestamp, sender, content, "clientId")
       VALUES ($1,$2,$3,$4,$5)
       ${ON_CLIENT_ID_CONFLICT} RETURNING *`,
      [msg.profileId, msg.timestamp || new Date(), msg.sender, msg.content, msg.clientId ?? null]
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
app.post('/api/workout-sets', ownBody, async (req, res) => {
  const s = req.body;
  try {
    // "exerciseId" has had a column since the catalogue landed and was never
    // listed here, so every set written in server mode lost its catalogue link.
    // "isCompleted" and "biserieGroupId" were the same story — the client has
    // always sent both and this INSERT named neither, so both were dropped on
    // the floor until migration 008 gave them columns.
    const { rows } = await pool.query(
      `INSERT INTO workout_sets ("workoutLogId", "profileId", "exerciseName", "exerciseId", "setNumber", reps, weight, timestamp, notes, "distanceKm", "duration", "speed", rpe, "isCompleted", "biserieGroupId", "clientId")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ${ON_CLIENT_ID_CONFLICT} RETURNING *`,
      [s.workoutLogId, s.profileId, s.exerciseName, s.exerciseId, s.setNumber, s.reps, s.weight, s.timestamp || new Date(), s.notes, s.distanceKm, s.duration, s.speed, s.rpe, s.isCompleted ?? null, s.biserieGroupId ?? null, s.clientId ?? null]
    );
    const r = rows[0];
    res.status(201).json({
      ...r,
      id: r.id.toString(),
      reps: num(r.reps),
      weight: num(r.weight),
      distanceKm: num(r.distanceKm),
      duration: num(r.duration),
      speed: num(r.speed),
      rpe: num(r.rpe)
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/workout-sets/:id', guardRow(pool, 'workout_sets'), async (req, res) => {
  try {
    await pool.query('DELETE FROM workout_sets WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/workouts/:workoutLogId/sets', guardWorkoutSets(pool), async (req, res) => {
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

// Every set a profile has ever logged. Personal records are only honest over the
// full history, so this is deliberately unbounded rather than windowed.
app.get('/api/profiles/:profileId/sets', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM workout_sets WHERE "profileId" = $1 ORDER BY timestamp ASC',
      [req.params.profileId]
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

app.delete('/api/workouts/:workoutLogId/sets', guardWorkoutSets(pool), async (req, res) => {
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

app.post('/api/exercise-favorites', ownBody, async (req, res) => {
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

app.delete('/api/exercise-favorites', guardQueryProfile(pool), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM exercise_favorites WHERE "profileId" = $1 AND "exerciseId" = $2',
      [req.query.profileId, req.query.exerciseId]
    );
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Routine Templates ────────────────────────────────────────────────────────
app.get('/api/profiles/:profileId/routines', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM routine_templates WHERE "profileId" = $1 ORDER BY "createdAt" DESC',
      [req.params.profileId]
    );
    res.json(rows.map(r => ({ ...r, id: r.id.toString(), createdAt: r.createdAt })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/routines/:id', guardRow(pool, 'routine_templates'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM routine_templates WHERE id = $1',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Routine not found' });
    res.json({ ...rows[0], id: rows[0].id.toString(), createdAt: rows[0].createdAt });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/routines', ownBody, async (req, res) => {
  const r = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO routine_templates ("profileId", title, description, "targetMuscles", exercises, "createdAt", "clientId")
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ${ON_CLIENT_ID_CONFLICT} RETURNING *`,
      [
        r.profileId,
        r.title,
        r.description || '',
        JSON.stringify(r.targetMuscles || []),
        JSON.stringify(r.exercises || []),
        r.createdAt || new Date(),
        r.clientId ?? null,
      ]
    );
    res.status(201).json({ ...rows[0], id: rows[0].id.toString(), createdAt: rows[0].createdAt });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/routines/:id', guardRow(pool, 'routine_templates'), async (req, res) => {
  try {
    await pool.query('DELETE FROM routine_templates WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Wellness ─────────────────────────────────────────────────────────────────
const wellnessNum = (r) => ({
  ...r,
  id: r.id.toString(),
  sleepMinutes: num(r.sleepMinutes),
  sleepDeepMinutes: num(r.sleepDeepMinutes),
  sleepRemMinutes: num(r.sleepRemMinutes),
  restingHr: num(r.restingHr),
  hrvMs: num(r.hrvMs),
});

app.get('/api/profiles/:profileId/wellness', async (req, res) => {
  const { since, until } = req.query;
  try {
    // `day` is a zero-padded TEXT date, so the range is a string comparison —
    // the same property the Dexie side relies on.
    const { rows } = await pool.query(
      `SELECT * FROM wellness_logs
       WHERE "profileId" = $1
         AND ($2::text IS NULL OR day >= $2)
         AND ($3::text IS NULL OR day <= $3)
       ORDER BY day ASC`,
      [req.params.profileId, since || null, until || null]
    );
    res.json(rows.map(wellnessNum));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/**
 * Upsert the day.
 *
 * `COALESCE(EXCLUDED.x, wellness_logs.x)` rather than a plain overwrite: the
 * sheet writes the four answers and the Health Connect import writes sleep and
 * resting heart rate, and whichever ran second would otherwise blank the
 * other's columns.
 */
// No `ownBody` here: both routes sit under the blanket `guardProfile` mounted on
// `/api/profiles/:profileId`, and the handler writes the path's profile rather
// than the body's, so there is nothing left for a body guard to catch.
app.put('/api/profiles/:profileId/wellness/:day', async (req, res) => {
  const w = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO wellness_logs
         ("profileId", day, timestamp, energy, soreness, stress, mood,
          "sleepMinutes", "sleepDeepMinutes", "sleepRemMinutes", "restingHr", "hrvMs",
          "sleepSource", notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT ("profileId", day) DO UPDATE SET
         timestamp = EXCLUDED.timestamp,
         energy = COALESCE(EXCLUDED.energy, wellness_logs.energy),
         soreness = COALESCE(EXCLUDED.soreness, wellness_logs.soreness),
         stress = COALESCE(EXCLUDED.stress, wellness_logs.stress),
         mood = COALESCE(EXCLUDED.mood, wellness_logs.mood),
         "sleepMinutes" = COALESCE(EXCLUDED."sleepMinutes", wellness_logs."sleepMinutes"),
         "sleepDeepMinutes" = COALESCE(EXCLUDED."sleepDeepMinutes", wellness_logs."sleepDeepMinutes"),
         "sleepRemMinutes" = COALESCE(EXCLUDED."sleepRemMinutes", wellness_logs."sleepRemMinutes"),
         "restingHr" = COALESCE(EXCLUDED."restingHr", wellness_logs."restingHr"),
         "hrvMs" = COALESCE(EXCLUDED."hrvMs", wellness_logs."hrvMs"),
         "sleepSource" = COALESCE(EXCLUDED."sleepSource", wellness_logs."sleepSource"),
         notes = COALESCE(EXCLUDED.notes, wellness_logs.notes)
       RETURNING *`,
      [
        req.params.profileId, req.params.day, w.timestamp || new Date(),
        w.energy, w.soreness, w.stress, w.mood,
        w.sleepMinutes, w.sleepDeepMinutes, w.sleepRemMinutes, w.restingHr, w.hrvMs,
        w.sleepSource, w.notes,
      ]
    );
    res.json(wellnessNum(rows[0]));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/wellness/:id', guardRow(pool, 'wellness_logs'), async (req, res) => {
  try {
    await pool.query('DELETE FROM wellness_logs WHERE id = $1', [req.params.id]);
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
if (!process.env.VERCEL) {
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
} else {
  initDb().catch((err) => {
    console.error('❌ Failed to initialize database on Vercel cold start:', err);
  });
}

export default app;
