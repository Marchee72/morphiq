/**
 * Verifies the deployed API exposes every endpoint the client calls.
 *
 * This exists because the two drifted silently: `/api/profiles/:id/sets` was
 * added to `server/index.js` and never deployed, so personal records quietly
 * fell back to a 120-day window instead of the full history. Nothing failed
 * loudly — the client just got a 404 and degraded.
 *
 *   node scripts/check-api.mjs [baseUrl]
 *
 * Exits non-zero if anything is missing, so it can gate a release.
 */
const BASE = process.argv[2] || process.env.VITE_API_URL || 'https://morphiq-eight.vercel.app';

/** Every path `src/data/database/ServerDatabase.ts` can request. `:id` is filled with a probe value. */
const ENDPOINTS = [
  ['GET', '/api/profiles'],
  ['GET', '/api/profiles/:id'],
  ['GET', '/api/profiles/:id/measurements'],
  ['GET', '/api/profiles/:id/food-logs'],
  ['GET', '/api/profiles/:id/workout-logs'],
  ['GET', '/api/profiles/:id/messages'],
  ['GET', '/api/profiles/:id/exercise-favorites'],
  ['GET', '/api/profiles/:id/routines'],
  ['GET', '/api/profiles/:id/sets'],
  ['GET', '/api/profiles/:id/exercises/sets?name=bench'],
  ['GET', '/api/workouts/pending/sets'],
];

async function probe(method, path, id) {
  const url = `${BASE}${path.replace(':id', id)}`;
  try {
    const res = await fetch(url, { method });
    return { url, status: res.status, ok: res.status !== 404 && res.status < 500 };
  } catch (err) {
    return { url, status: 0, ok: false, error: err.message };
  }
}

async function main() {
  console.log(`Checking ${BASE}\n`);

  // Probe against a real profile so a 404 means "no such route", not "no such row".
  let id = '1';
  try {
    const profiles = await (await fetch(`${BASE}/api/profiles`)).json();
    if (Array.isArray(profiles) && profiles[0]?.id) id = String(profiles[0].id);
  } catch {
    console.error('Could not reach /api/profiles — is the deployment up?');
    process.exit(1);
  }

  const results = await Promise.all(ENDPOINTS.map(([m, p]) => probe(m, p, id)));
  let missing = 0;

  for (const [i, r] of results.entries()) {
    const [, path] = ENDPOINTS[i];
    const mark = r.ok ? 'ok  ' : 'MISS';
    if (!r.ok) missing++;
    console.log(`  ${mark} ${String(r.status).padStart(3)}  ${path}`);
  }

  console.log();
  if (missing > 0) {
    console.error(`${missing} endpoint(s) missing from the deployment. Run: npm run deploy:api`);
    process.exit(1);
  }
  console.log('Deployment matches the client.');
}

main();
