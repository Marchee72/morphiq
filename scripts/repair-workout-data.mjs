/**
 * Repairs the workout data described by scripts/audit-workout-data.mjs.
 *
 * Three operations, all approved against a specific audit run:
 *
 *   1. Delete demo logs and their sets — the four fixtures in
 *      src/data/mock/mockData.ts, inserted afresh on every "Load demo" press.
 *   2. Retype synced non-strength logs that hold weighted sets, so a gym
 *      session filed under WALKING/OTHER by the old health-sync merge reads as
 *      what it contains. No set is moved, created or deleted.
 *   3. Collapse duplicate log rows that hold NO sets at all, keeping the
 *      lowest id.
 *
 * Deliberately NOT done: anything to groups whose copies hold differing set
 * counts (they may be distinct sessions), and anything to synced logs whose
 * sets carry no weight (they may be genuine cardio).
 *
 * Dry run by default — prints the plan and exits. Pass --apply to write.
 * Every row it would change or delete is dumped to a timestamped JSON file
 * before anything is written, so each step can be undone.
 *
 *   node --env-file=.env scripts/repair-workout-data.mjs
 *   node --env-file=.env scripts/repair-workout-data.mjs --apply
 */

import { writeFileSync } from 'node:fs';
import pg from '../server/node_modules/pg/lib/index.js';

const { Pool } = pg;
const APPLY = process.argv.includes('--apply');

const STRENGTH = /\b(strength|weight ?(lifting|training)|weightlifting|weights|resistance|powerlifting|bodybuilding|gym|weight machine|fuerza|pesas|musculacion)\b/;

const isStrength = (type) =>
  Boolean(type) &&
  STRENGTH.test(type.toLowerCase().replace(/[_-]+/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '').trim());

const DEMO_TEMPLATES = new Set([
  'Chest & Triceps|Barbell Bench Press, Incline DB Flyes, Overhead Cable Extensions',
  'Back & Biceps|Lat Pulldowns, Barbell Rows, Hammer Curls',
  'Leg Day & Core|Barbell Squats, Romanian Deadlifts, Leg Extensions',
  'Outdoor Running|Morning tempo run along the park route',
]);
const isDemo = (log) => DEMO_TEMPLATES.has(`${log.type}|${log.description}`);

const RETYPE_TO = 'Strength Training';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Run with: node --env-file=.env scripts/repair-workout-data.mjs');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const { rows: logs } = await pool.query(
    `SELECT id, "profileId", timestamp, type, duration, description, source,
            "externalId", "caloriesBurned", "distanceKm", "avgHeartRate", "maxHeartRate"
       FROM workout_logs ORDER BY id`,
  );
  const { rows: sets } = await pool.query(`SELECT * FROM workout_sets`);

  const setsByLog = new Map();
  for (const s of sets) {
    const key = String(s.workoutLogId);
    if (!setsByLog.has(key)) setsByLog.set(key, []);
    setsByLog.get(key).push(s);
  }
  const setsOf = (log) => setsByLog.get(String(log.id)) ?? [];

  // ── Plan ───────────────────────────────────────────────────────────────────

  const demoLogs = logs.filter(isDemo);
  const realLogs = logs.filter((l) => !isDemo(l));

  // Only weighted sets prove a strength session; a zero-weight synced log may
  // genuinely be cardio, so it is left for a human.
  const retypeLogs = realLogs.filter(
    (l) =>
      l.source === 'health-connect' &&
      !isStrength(l.type) &&
      setsOf(l).some((s) => Number(s.weight ?? 0) > 0 && Number(s.reps ?? 0) > 0),
  );

  const groups = new Map();
  for (const l of realLogs) {
    const key = [l.profileId, l.type, new Date(l.timestamp).toISOString().slice(0, 16), l.duration].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  }
  // Strictly: every copy must hold zero sets. Collapsing a group whose copies
  // hold sets would destroy training data, so it is never attempted here.
  const collapseGroups = [...groups.values()].filter(
    (g) => g.length > 1 && g.every((l) => setsOf(l).length === 0),
  );
  const collapseDeletes = collapseGroups.flatMap((g) =>
    [...g].sort((a, b) => a.id - b.id).slice(1),
  );

  const deleteLogs = [...demoLogs, ...collapseDeletes];
  const deleteSets = deleteLogs.flatMap(setsOf);

  console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN — nothing will be written'}\n`);
  console.log(`  delete demo logs            : ${demoLogs.length} logs, ${demoLogs.reduce((t, l) => t + setsOf(l).length, 0)} sets`);
  console.log(`  collapse empty duplicates   : ${collapseDeletes.length} logs, 0 sets`);
  console.log(`  retype stranded synced logs : ${retypeLogs.length} logs, 0 sets touched`);
  console.log(`\n  total rows deleted          : ${deleteLogs.length} logs, ${deleteSets.length} sets`);
  console.log(`  logs remaining              : ${logs.length - deleteLogs.length}`);
  console.log(`  sets remaining              : ${sets.length - deleteSets.length}\n`);

  for (const l of retypeLogs) {
    console.log(`  retype  id ${l.id}  "${l.type}" → "${RETYPE_TO}", source '${l.source}' → 'manual'  (${setsOf(l).length} sets stay put)`);
  }
  for (const g of collapseGroups) {
    const ordered = [...g].sort((a, b) => a.id - b.id);
    console.log(`  collapse ${g[0].type} @ ${new Date(g[0].timestamp).toISOString().slice(0, 16)} — keep ${ordered[0].id}, delete ${ordered.slice(1).map((l) => l.id).join(', ')}`);
  }
  console.log(`  delete   ${demoLogs.length} demo logs: ${demoLogs.map((l) => l.id).join(', ')}`);

  if (!APPLY) {
    console.log(`\nRe-run with --apply to write these changes.\n`);
    await pool.end();
    return;
  }

  // ── Backup ─────────────────────────────────────────────────────────────────

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = `workout-repair-backup-${stamp}.json`;
  writeFileSync(
    file,
    JSON.stringify(
      {
        takenAt: new Date().toISOString(),
        note: 'Rows deleted or modified by scripts/repair-workout-data.mjs. `retyped` holds each log as it was BEFORE the change.',
        deletedLogs: deleteLogs,
        deletedSets: deleteSets,
        retyped: retypeLogs,
      },
      null,
      2,
    ),
  );
  console.log(`\nBackup written to ${file} (${deleteLogs.length} logs, ${deleteSets.length} sets, ${retypeLogs.length} retyped).`);

  // ── Apply, all or nothing ──────────────────────────────────────────────────

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (deleteLogs.length > 0) {
      const ids = deleteLogs.map((l) => l.id);
      // Sets key on workoutLogId as TEXT, with no foreign key to cascade.
      await client.query('DELETE FROM workout_sets WHERE "workoutLogId" = ANY($1::text[])', [ids.map(String)]);
      await client.query('DELETE FROM workout_logs WHERE id = ANY($1::int[])', [ids]);
    }

    for (const l of retypeLogs) {
      await client.query(
        `UPDATE workout_logs
            SET type = $1, source = 'manual',
                description = COALESCE(NULLIF(description, ''), $2)
          WHERE id = $3`,
        [RETYPE_TO, `Recovered from ${l.type} record`, l.id],
      );
    }

    await client.query('COMMIT');
    console.log('Committed.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Rolled back, nothing changed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Repair failed:', err.message);
  process.exit(1);
});
