/**
 * Read-only audit of workout_logs / workout_sets.
 *
 * Separates three things that look alike in the history list:
 *
 *  1. Real damage from the old health-sync merge (store.ts importWorkouts,
 *     fixed 2026-07-28). It merged a manual session into *any* synced record
 *     within four hours regardless of activity type, re-pointing the session's
 *     sets onto the synced log and deleting the session — so walks and 'OTHER'
 *     records ended up owning full gym sessions.
 *  2. Demo data from Settings → "Load demo", which inserts a fresh copy every
 *     time it is pressed and is indistinguishable from real training in the UI.
 *  3. Duplicate rows from anything else.
 *
 * Only a synced log's `type` is an activity type — a manual log's type is the
 * session name the user chose, which may be anything. Rule 1 is therefore
 * applied only to `source = 'health-connect'` rows.
 *
 * This script only SELECTs. It writes nothing.
 *
 *   node --env-file=.env scripts/audit-workout-data.mjs
 */

import pg from '../server/node_modules/pg/lib/index.js';

const { Pool } = pg;

const STRENGTH = /\b(strength|weight ?(lifting|training)|weightlifting|weights|resistance|powerlifting|bodybuilding|gym|weight machine|fuerza|pesas|musculacion)\b/;

const isStrength = (type) =>
  Boolean(type) &&
  STRENGTH.test(type.toLowerCase().replace(/[_-]+/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '').trim());

/** The four templates in src/data/mock/mockData.ts, keyed as `type|description`. */
const DEMO_TEMPLATES = new Set([
  'Chest & Triceps|Barbell Bench Press, Incline DB Flyes, Overhead Cable Extensions',
  'Back & Biceps|Lat Pulldowns, Barbell Rows, Hammer Curls',
  'Leg Day & Core|Barbell Squats, Romanian Deadlifts, Leg Extensions',
  'Outdoor Running|Morning tempo run along the park route',
]);

const isDemo = (log) => DEMO_TEMPLATES.has(`${log.type}|${log.description}`);

const pad = (s, n) => String(s).padEnd(n);
const day = (d) => new Date(d).toISOString().slice(0, 10);
const clock = (d) => new Date(d).toISOString().slice(11, 16);

function heading(title) {
  console.log(`\n${'─'.repeat(78)}\n${title}\n${'─'.repeat(78)}`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Run with: node --env-file=.env scripts/audit-workout-data.mjs');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  // workout_logs has no feelingTag/bodyNotes columns server-side, though the
  // WorkoutLog entity and the local Dexie schema both carry them.
  const { rows: logs } = await pool.query(
    `SELECT id, "profileId", timestamp, type, duration, description, source,
            "externalId", "caloriesBurned"
       FROM workout_logs
      ORDER BY timestamp DESC`,
  );
  const { rows: sets } = await pool.query(
    `SELECT id, "workoutLogId", "profileId", "exerciseName", "setNumber", reps, weight, timestamp
       FROM workout_sets`,
  );

  const setsByLog = new Map();
  for (const s of sets) {
    const key = String(s.workoutLogId);
    if (!setsByLog.has(key)) setsByLog.set(key, []);
    setsByLog.get(key).push(s);
  }
  const setsOf = (log) => setsByLog.get(String(log.id)) ?? [];
  const logIds = new Set(logs.map((l) => String(l.id)));

  console.log(`\nMorphIQ workout data audit — READ ONLY, nothing is modified.`);
  console.log(`${logs.length} workout logs, ${sets.length} sets.`);

  const demoLogs = logs.filter(isDemo);
  const realLogs = logs.filter((l) => !isDemo(l));

  // ── 1. Real merge damage ───────────────────────────────────────────────────
  heading('1. Gym sets stranded on a synced non-strength activity');

  const stranded = realLogs
    .filter((l) => l.source === 'health-connect' && !isStrength(l.type) && setsOf(l).length > 0)
    .map((l) => {
      const own = setsOf(l);
      const volume = own.reduce((t, s) => t + Number(s.weight ?? 0) * Number(s.reps ?? 0), 0);
      return { log: l, sets: own, exercises: [...new Set(own.map((s) => s.exerciseName))], volume };
    });

  if (stranded.length === 0) {
    console.log('None.');
  } else {
    console.log(`${stranded.length} synced logs carry sets they should not own.\n`);
    for (const s of stranded) {
      const lifted = s.volume > 0;
      console.log(
        `  log ${pad(s.log.id, 6)} ${day(s.log.timestamp)} ${clock(s.log.timestamp)}  ` +
        `${pad(s.log.type ?? '—', 10)} ${pad(s.sets.length + ' sets', 9)} ${pad(Math.round(s.volume) + ' kg', 11)}` +
        (lifted ? '' : '  (no weight — may be genuine cardio)'),
      );
      console.log(`           ${s.exercises.join(', ')}`);
    }
    console.log(`\n  Repair: retype these logs as strength work and set source='manual',`);
    console.log(`  so they read as the session they actually contain. The sets stay put —`);
    console.log(`  they are the only surviving record of that session.`);
    console.log(`  Rows marked "may be genuine cardio" are excluded; decide those yourself.`);
  }

  // ── 2. Demo data ───────────────────────────────────────────────────────────
  heading('2. Demo data from Settings → "Load demo"');

  if (demoLogs.length === 0) {
    console.log('None.');
  } else {
    const byTemplate = new Map();
    for (const l of demoLogs) {
      const key = l.type;
      if (!byTemplate.has(key)) byTemplate.set(key, []);
      byTemplate.get(key).push(l);
    }
    const demoSetCount = demoLogs.reduce((t, l) => t + setsOf(l).length, 0);
    console.log(`${demoLogs.length} demo logs and ${demoSetCount} demo sets — the demo was loaded`);
    console.log(`${Math.max(...byTemplate.values().map((g) => g.length))} times, each press inserting a fresh copy.\n`);
    for (const [type, group] of byTemplate) {
      console.log(`  ${pad(type, 20)} ${pad(group.length + ' copies', 12)} ids ${group.map((l) => l.id).join(', ')}`);
    }
    console.log(`\n  Repair: delete every one of these, with their sets. They are fabricated`);
    console.log(`  and are inflating your volume, records and muscle balance.`);
    console.log(`\n  Do NOT use the Settings "Clear demo" button for this: clearMockData`);
    console.log(`  (store.ts:1571) deletes ALL workouts, measurements, food logs and chat`);
    console.log(`  for the profile, not only the demo rows.`);
  }

  // ── 3. Duplicates among real logs ──────────────────────────────────────────
  heading('3. Duplicate rows among your real logs');

  const groups = new Map();
  for (const l of realLogs) {
    const key = [l.profileId, l.type, new Date(l.timestamp).toISOString().slice(0, 16), l.duration].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(l);
  }

  const dupes = [...groups.values()].filter((g) => g.length > 1);
  if (dupes.length === 0) {
    console.log('None.');
  } else {
    console.log(`${dupes.length} duplicated events, ${dupes.reduce((t, g) => t + g.length - 1, 0)} redundant rows.\n`);
    for (const g of dupes.sort((a, b) => b.length - a.length)) {
      const counts = g.map((l) => setsOf(l).length);
      const identical = new Set(counts).size === 1;
      console.log(`  ${pad(g.length + ' copies', 11)} ${day(g[0].timestamp)} ${clock(g[0].timestamp)}  ${pad(g[0].type ?? '—', 20)}`);
      console.log(`              sets per copy: ${counts.join(', ')}${identical ? '  (identical — safe to collapse)' : '  (DIFFER — needs your judgement)'}`);
      console.log(`              ids: ${g.map((l) => l.id).join(', ')}`);
    }
    console.log(`\n  Repair: for groups whose copies hold identical set counts, keep the`);
    console.log(`  lowest id and delete the others together with their sets. Groups whose`);
    console.log(`  counts differ are left alone — they may be distinct sessions.`);
  }

  // ── 4. Orphaned sets ───────────────────────────────────────────────────────
  heading('4. Orphaned sets (workoutLogId points at no log)');

  const orphans = sets.filter((s) => !logIds.has(String(s.workoutLogId)));
  if (orphans.length === 0) {
    console.log('None.');
  } else {
    const byLog = new Map();
    for (const s of orphans) {
      const key = String(s.workoutLogId);
      if (!byLog.has(key)) byLog.set(key, []);
      byLog.get(key).push(s);
    }
    console.log(`${orphans.length} sets across ${byLog.size} missing logs.\n`);
    for (const [logId, own] of byLog) {
      console.log(`  workoutLogId ${pad(logId, 10)} ${pad(own.length + ' sets', 10)} ${day(own[0].timestamp)}  ${[...new Set(own.map((s) => s.exerciseName))].slice(0, 4).join(', ')}`);
    }
    console.log(`\n  Repair: rebuild a workout log for each group from its sets, so the work`);
    console.log(`  reappears in history instead of counting only toward records.`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  heading('What a repair would change');

  const strandedFixable = stranded.filter((s) => s.volume > 0);
  const collapsible = dupes.filter((g) => new Set(g.map((l) => setsOf(l).length)).size === 1);
  const demoSets = demoLogs.reduce((t, l) => t + setsOf(l).length, 0);
  const dupeRows = collapsible.reduce((t, g) => t + g.length - 1, 0);
  const dupeSets = collapsible.reduce(
    (t, g) => t + g.slice(1).reduce((n, l) => n + setsOf(l).length, 0), 0);

  console.log(`  retype stranded synced logs      : ${strandedFixable.length} logs      (0 sets touched)`);
  console.log(`  delete demo logs                 : ${demoLogs.length} logs, ${demoSets} sets`);
  console.log(`  collapse duplicate real logs     : ${dupeRows} logs, ${dupeSets} sets`);
  console.log(`  rebuild logs for orphaned sets   : ${new Set(orphans.map((s) => String(s.workoutLogId))).size} logs`);
  console.log(`\n  Logs remaining afterwards        : ${logs.length - demoLogs.length - dupeRows}`);
  console.log(`  Sets remaining afterwards        : ${sets.length - demoSets - dupeSets}\n`);

  await pool.end();
}

main().catch((err) => {
  console.error('Audit failed:', err.message);
  process.exit(1);
});
