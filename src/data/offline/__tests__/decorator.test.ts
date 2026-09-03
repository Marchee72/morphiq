import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { clearSession, setSession } from '../../auth/session';

/**
 * The repository decorators, against a server that is variously up, wrong, and
 * gone.
 *
 * The distinction being pinned here is the one the whole layer turns on. A read
 * that fails because the network is gone should answer from the cache — that is
 * the feature. A read that fails because the server said 400 should throw, or a
 * real bug hides behind stale data forever. A 401 must reach `App.tsx` or the
 * sign-in wall never goes back up.
 *
 * `vite.config.ts` forces `VITE_DB_TYPE: 'local'` for the suite, and
 * `isServerMode` resolves at import time, so the only way in is a fresh module
 * graph. `authGate.test.ts` established this idiom; the warning in its comment
 * applies here too — the graph carries its own `session` and its own Dexie
 * handle, so asserting against this file's imports would read a different
 * instance.
 */

const USER = { id: 1, email: 'marchee72@gmail.com', name: 'Marche', picture: null };
const P = '1';

type FetchResult = Partial<Response> | Error;

/** The decorated repositories, with `fetch` answering from `answer`. */
async function serverMode(answer: () => FetchResult) {
  vi.resetModules();
  vi.stubEnv('VITE_DB_TYPE', 'server');
  vi.stubEnv('VITE_API_URL', 'https://example.test');

  const fetchMock = vi.fn(async () => {
    const result = answer();
    if (result instanceof Error) throw result;
    return result as Response;
  });
  vi.stubGlobal('fetch', fetchMock);

  const [offline, session, connectivity, snapshot, db] = await Promise.all([
    import('../offlineRepositories'),
    import('../../auth/session'),
    import('../connectivity'),
    import('../snapshot'),
    import('../offlineDb'),
  ]);

  session.setSession({ token: 't', user: USER });
  connectivity.resetConnectivity();

  const server = await import('../../database/ServerDatabase');
  const repos = offline.decorateRepositories({
    profile: new server.ServerUserProfileRepository(),
    measurement: new server.ServerMeasurementRepository(),
    food: new server.ServerFoodLogRepository(),
    workout: new server.ServerWorkoutLogRepository(),
    message: new server.ServerMessageRepository(),
    workoutSet: new server.ServerWorkoutSetRepository(),
    favorite: new server.ServerFavoriteExerciseRepository(),
    routine: new server.ServerRoutineTemplateRepository(),
    wellness: new server.ServerWellnessLogRepository(),
  });

  return { repos, fetchMock, session, connectivity, snapshot, db };
}

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const status = (code: number) => ({ ok: false, status: code, json: async () => ({ error: `HTTP ${code}` }) });
const DEAD = new TypeError('Failed to fetch');

const LOG = { id: '10', profileId: P, type: 'strength', timestamp: '2026-09-02T10:00:00.000Z' };

beforeEach(async () => {
  setSession({ token: 't', user: USER });
  const { offlineDb } = await import('../offlineDb');
  await offlineDb().rows.clear();
  await offlineDb().meta.clear();
  await offlineDb().ops.clear();
});

afterEach(async () => {
  clearSession();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('a read that succeeds', () => {
  it('returns the server\'s answer and keeps a copy', async () => {
    const { repos, db, snapshot } = await serverMode(() => ok([LOG]));

    const rows = await repos.workout.getAll(P);
    expect(rows).toHaveLength(1);

    // Cached by the read itself, not by a separate save step — so the cache is
    // filled by exactly the paths that already load the app.
    await db.offlineDb().meta.put({ key: 'account', userId: USER.id, savedAt: new Date() });
    expect(await snapshot.readPartition('workoutLog', P)).toHaveLength(1);
  });
});

describe('a read against a dead network', () => {
  it('answers from the cache instead of throwing', async () => {
    let alive = true;
    const { repos } = await serverMode(() => (alive ? ok([LOG]) : DEAD));

    await repos.workout.getAll(P);
    alive = false;

    const rows = await repos.workout.getAll(P);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('10');
  });

  it('answers with nothing when there is nothing cached, rather than an error', async () => {
    // An empty screen is bad; a crash on a screen the user opened offline is
    // worse, and there is nothing they could do about it either way.
    const { repos } = await serverMode(() => DEAD);
    await expect(repos.workout.getAll(P)).resolves.toEqual([]);
  });

  it.each([408, 429, 502, 503, 504])('falls back on a %d', async (code) => {
    let alive = true;
    const { repos } = await serverMode(() => (alive ? ok([LOG]) : status(code)));

    await repos.workout.getAll(P);
    alive = false;
    await expect(repos.workout.getAll(P)).resolves.toHaveLength(1);
  });
});

describe('a read the server refused', () => {
  it.each([400, 403, 404, 500])('lets a %d through rather than hiding it behind the cache', async (code) => {
    let alive = true;
    const { repos } = await serverMode(() => (alive ? ok([LOG]) : status(code)));

    await repos.workout.getAll(P);
    alive = false;

    // Answering from the cache here would mean a genuine bug reads as stale
    // data forever, with nothing anywhere reporting it.
    await expect(repos.workout.getAll(P)).rejects.toThrow();
  });

  it('lets a 401 through so the sign-in wall can go back up', async () => {
    const { repos } = await serverMode(() => status(401));
    await expect(repos.workout.getAll(P)).rejects.toThrow('Session expired');
  });
});

describe('profiles — the offline boot depends on this read', () => {
  it('serves the cached profiles when the API is unreachable', async () => {
    /**
     * `loadProfiles` marks itself loaded even when the read throws, and
     * `App.tsx` then reads an empty list as "new user" and opens the sign-up
     * form. So an offline launch with a bare repository lands on onboarding —
     * a form whose every write fails. This read is what prevents it.
     */
    let alive = true;
    const { repos } = await serverMode(() =>
      (alive ? ok([{ id: '1', name: 'Marche', birthDate: '1996-05-24', createdAt: '2026-01-01' }]) : DEAD));

    await repos.profile.getAll();
    alive = false;

    const profiles = await repos.profile.getAll();
    expect(profiles).toHaveLength(1);
  });

  it('answers get(id) from the cache instead of the inner catch-all undefined', async () => {
    // `ServerUserProfileRepository.get` swallows every error and returns
    // undefined, which `setActiveProfile` reads as "nothing to do" — no
    // profile, no data, no error, a blank app. Going through `getAll` is what
    // gets a real failure back, because `getAll` does not catch.
    let alive = true;
    const { repos } = await serverMode(() =>
      (alive ? ok([{ id: '1', name: 'Marche', birthDate: '1996-05-24', createdAt: '2026-01-01' }]) : DEAD));

    await repos.profile.get('1');
    alive = false;

    expect(await repos.profile.get('1')).toMatchObject({ id: '1' });
  });

  it('reports a profile the server has genuinely deleted as gone, not stale', async () => {
    // The other half of routing `get` through `getAll`: a cached row must not
    // outlive the account it belonged to.
    let profiles: unknown[] = [{ id: '1', name: 'Marche', birthDate: '1996-05-24', createdAt: '2026-01-01' }];
    const { repos } = await serverMode(() => ok(profiles));

    await repos.profile.get('1');
    profiles = [];

    expect(await repos.profile.get('1')).toBeUndefined();
  });
});

describe('measurements — getLatest', () => {
  it('goes through the decorator\'s own getAll, not the inner one', async () => {
    /**
     * `ServerMeasurementRepository.getLatest` calls `this.getAll` — its own.
     * Delegated, it would reach past the cache to the network and fail offline
     * while `getAll` beside it succeeded. It is the only self-delegating method
     * across the nine, which is what makes it easy to miss.
     */
    let alive = true;
    const rows = [
      { id: '1', profileId: P, timestamp: '2026-09-01T10:00:00.000Z', weight: 80 },
      { id: '2', profileId: P, timestamp: '2026-09-02T10:00:00.000Z', weight: 81 },
    ];
    const { repos } = await serverMode(() => (alive ? ok(rows) : DEAD));

    await repos.measurement.getAll(P);
    alive = false;

    const latest = await repos.measurement.getLatest(P);
    expect(latest?.weight).toBe(81);
  });
});

describe('partial reads', () => {
  it('does not let one day\'s read erase the rest of the history', async () => {
    /**
     * The destructive case, and one nothing would report. A dated `getAll`
     * asks for a slice; if it replaced the partition, tapping a date would
     * delete every other day the user had cached.
     */
    const all = [
      { ...LOG, id: '1', timestamp: '2026-09-01T10:00:00.000Z' },
      { ...LOG, id: '2', timestamp: '2026-09-02T10:00:00.000Z' },
      { ...LOG, id: '3', timestamp: '2026-09-03T10:00:00.000Z' },
    ];
    let answer: unknown = all;
    const { repos } = await serverMode(() => ok(answer));

    await repos.workout.getAll(P);              // complete read: three days
    answer = [all[1]];
    await repos.workout.getAll(P, new Date('2026-09-02T12:00:00'));  // one day

    // Offline, the whole history must still be there.
    const dead = await serverMode(() => DEAD);
    expect(await dead.repos.workout.getAll(P)).toHaveLength(3);
  });

  it('filters the cache the same way the server filters the query', async () => {
    const all = [
      { ...LOG, id: '1', timestamp: '2026-09-01T10:00:00.000Z' },
      { ...LOG, id: '2', timestamp: '2026-09-02T10:00:00.000Z' },
    ];
    let alive = true;
    const { repos } = await serverMode(() => (alive ? ok(all) : DEAD));

    await repos.workout.getAll(P);
    alive = false;

    const day = await repos.workout.getAll(P, new Date('2026-09-02T18:30:00'));
    expect(day.map(r => r.id)).toEqual(['2']);
  });

  it('reproduces the server\'s ordering for getRange', async () => {
    // The cache has no other source for it, and `loadWorkoutHistory` renders in
    // the order it is handed.
    const all = [
      { ...LOG, id: '1', timestamp: '2026-09-01T10:00:00.000Z' },
      { ...LOG, id: '2', timestamp: '2026-09-03T10:00:00.000Z' },
      { ...LOG, id: '3', timestamp: '2026-09-02T10:00:00.000Z' },
    ];
    let alive = true;
    const { repos } = await serverMode(() => (alive ? ok(all) : DEAD));

    await repos.workout.getAll(P);
    alive = false;

    const range = await repos.workout.getRange(P, new Date('2026-09-01'), new Date('2026-09-04'));
    expect(range.map(r => r.id)).toEqual(['2', '3', '1']);
  });
});

describe('workout sets', () => {
  it('finds a workout\'s sets offline, with no profileId to scope by', async () => {
    const sets = [
      { id: 's1', profileId: P, workoutLogId: '10', setNumber: 2, exerciseName: 'Squat', timestamp: '2026-09-02T10:00:00.000Z' },
      { id: 's2', profileId: P, workoutLogId: '10', setNumber: 1, exerciseName: 'Squat', timestamp: '2026-09-02T10:00:00.000Z' },
      { id: 's3', profileId: P, workoutLogId: '11', setNumber: 1, exerciseName: 'Bench', timestamp: '2026-09-02T10:00:00.000Z' },
    ];
    let alive = true;
    const { repos } = await serverMode(() => (alive ? ok(sets) : DEAD));

    await repos.workoutSet.getAllForProfile(P);
    alive = false;

    const forWorkout = await repos.workoutSet.getForWorkout('10');
    expect(forWorkout.map(s => s.id)).toEqual(['s2', 's1']);   // by setNumber
  });

  it("keeps the 'pending' sets a routine files under a literal id", async () => {
    // `linkPendingRoutineToWorkout` parks un-linked routine sets under the
    // literal 'pending'. It is not a temp id and must survive as itself.
    const sets = [{ id: 's1', profileId: P, workoutLogId: 'pending', setNumber: 1, exerciseName: 'Squat', timestamp: '2026-09-02T10:00:00.000Z' }];
    let alive = true;
    const { repos } = await serverMode(() => (alive ? ok(sets) : DEAD));

    await repos.workoutSet.getAllForProfile(P);
    alive = false;

    expect(await repos.workoutSet.getForWorkout('pending')).toHaveLength(1);
  });
});

describe('wellness', () => {
  it('never replaces its partition, because every read is a window', async () => {
    // `WELLNESS_WINDOW_DAYS` bounds every wellness read; replacing would delete
    // days a wider window would later want, and nothing would refetch them.
    const days = [
      { id: '1', profileId: P, day: '2026-06-01', timestamp: '2026-06-01T00:00:00.000Z', energy: 3 },
      { id: '2', profileId: P, day: '2026-09-02', timestamp: '2026-09-02T00:00:00.000Z', energy: 4 },
    ];
    let answer: unknown = days;
    const { repos } = await serverMode(() => ok(answer));

    await repos.wellness.getRange(P, '2026-01-01');
    answer = [days[1]];
    await repos.wellness.getRange(P, '2026-09-01');

    const dead = await serverMode(() => DEAD);
    expect(await dead.repos.wellness.getRange(P, '2026-01-01')).toHaveLength(2);
  });

  it('finds a single day offline', async () => {
    const days = [{ id: '2', profileId: P, day: '2026-09-02', timestamp: '2026-09-02T00:00:00.000Z', energy: 4 }];
    let alive = true;
    const { repos } = await serverMode(() => (alive ? ok(days) : DEAD));

    await repos.wellness.getRange(P, '2026-01-01');
    alive = false;

    expect(await repos.wellness.getForDay(P, '2026-09-02')).toMatchObject({ energy: 4 });
    expect(await repos.wellness.getForDay(P, '2026-09-01')).toBeUndefined();
  });
});
