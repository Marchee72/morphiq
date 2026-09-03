import { describe, expect, it, afterEach, vi } from 'vitest';

/**
 * The acceptance test: a workout logged in a gym with no signal.
 *
 * This is the shape of `finishActiveSession` — one workout insert whose id N
 * set inserts then reference — driven through the offline layer end to end,
 * exactly as the store drives it. If only one test in this feature survives, it
 * should be this one.
 *
 * The second half is the part that is easy to get wrong and impossible to
 * notice: flushing twice, as a phone with bad signal genuinely does when a
 * response is lost, must still leave one workout rather than two.
 */

const USER = { id: 1, email: 'marchee72@gmail.com', name: 'Marche', picture: null };
const P = '1';

interface Call { url: string; method: string; body: Record<string, unknown> }

/** Stands in for Postgres, including the unique index on (profileId, clientId). */
function fakeServer() {
  const workouts = new Map<string, { id: string }>();
  const sets = new Map<string, { id: string; workoutLogId: string }>();
  let nextId = 100;
  let reachable = true;
  /** Answer the next request but pretend the reply was lost on the way back. */
  let swallowNext = false;

  const insert = (store: Map<string, { id: string }>, body: Record<string, unknown>) => {
    const key = String(body.clientId);
    // ON CONFLICT ("profileId", "clientId") DO UPDATE … RETURNING *
    const existing = store.get(key);
    if (existing) return existing;
    const row = { id: String(nextId++), ...body } as { id: string; workoutLogId: string };
    store.set(key, row);
    return row;
  };

  return {
    get workouts() { return [...workouts.values()]; },
    get sets() { return [...sets.values()]; },
    setReachable(v: boolean) { reachable = v; },
    swallowOne() { swallowNext = true; },

    handle(call: Call): Partial<Response> | Error {
      if (!reachable) throw new TypeError('Failed to fetch');

      if (call.url.includes('/workout-logs')) {
        const row = insert(workouts, call.body);
        // The write landed; the answer did not come back. Indistinguishable
        // from "never arrived" on the phone, which is the whole problem.
        if (swallowNext) { swallowNext = false; throw new TypeError('Failed to fetch'); }
        return { ok: true, status: 201, json: async () => row } as Partial<Response>;
      }

      if (call.url.includes('/workout-sets')) {
        const row = insert(sets as Map<string, { id: string }>, call.body);
        if (swallowNext) { swallowNext = false; throw new TypeError('Failed to fetch'); }
        return { ok: true, status: 201, json: async () => row } as Partial<Response>;
      }

      return { ok: true, status: 200, json: async () => [] } as Partial<Response>;
    },
  };
}

async function harness() {
  vi.resetModules();
  vi.stubEnv('VITE_DB_TYPE', 'server');
  vi.stubEnv('VITE_API_URL', 'https://example.test');

  const api = fakeServer();
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const result = api.handle({
      url,
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(init.body as string) : {},
    });
    if (result instanceof Error) throw result;
    return result as Response;
  }));

  const [offline, session, connectivity, flusher, outbox, dbMod, server] = await Promise.all([
    import('../offlineRepositories'),
    import('../../auth/session'),
    import('../connectivity'),
    import('../flusher'),
    import('../outbox'),
    import('../offlineDb'),
    import('../../database/ServerDatabase'),
  ]);

  session.setSession({ token: 't', user: USER });
  connectivity.resetConnectivity();
  flusher.resetFlusher();

  const db = dbMod.offlineDb();
  for (const table of [db.rows, db.ops, db.ids, db.meta]) await table.clear();

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

  return { repos, api, flusher, outbox, connectivity };
}

/**
 * What `store.ts` does when you tap Finish, minus the store.
 *
 * Deliberately mirrors `finishActiveSession` line for line — one `add`, then a
 * `Promise.all` of set writes carrying the id it returned — because the point
 * is that *that code needs no changes*. If this has to diverge from it to pass,
 * the offline layer has failed at the thing it was built for.
 */
async function finishSession(repos: Awaited<ReturnType<typeof harness>>['repos'], setCount: number) {
  const logId = await repos.workout.add({
    profileId: P, type: 'strength', timestamp: new Date(), duration: 45,
    description: `${setCount} sets completed`, source: 'manual',
  });

  const writtenAt = new Date();
  await Promise.all(Array.from({ length: setCount }, (_, i) => repos.workoutSet.add({
    workoutLogId: logId,
    profileId: P,
    exerciseName: i < 6 ? 'Back Squat' : 'Bench Press',
    setNumber: (i % 6) + 1,
    reps: 5,
    weight: 100 + i,
    isCompleted: true,
    timestamp: writtenAt,
  })));

  return logId;
}

afterEach(async () => {
  const { resetFlusher } = await import('../flusher');
  resetFlusher();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('a twelve-set session logged with no signal', () => {
  it('is on screen immediately and reaches the server intact', async () => {
    const h = await harness();
    h.api.setReachable(false);
    h.connectivity.reportUnreachable();

    const logId = await finishSession(h.repos, 12);

    // One workout plus twelve sets, waiting.
    expect(await h.outbox.pendingCount()).toBe(13);

    // And already visible — the store's read-back after finishing goes through
    // the same repositories and finds the optimistic rows.
    const today = await h.repos.workout.getAll(P);
    expect(today).toHaveLength(1);
    expect(await h.repos.workoutSet.getForWorkout(logId)).toHaveLength(12);

    // Back on the bus.
    h.api.setReachable(true);
    h.connectivity.reportReachable();
    await h.flusher.flush();

    expect(h.api.workouts).toHaveLength(1);
    expect(h.api.sets).toHaveLength(12);
    expect(await h.outbox.pendingCount()).toBe(0);

    // Every set filed under the workout's real id, not the placeholder.
    const realId = h.api.workouts[0].id;
    expect(h.api.sets.every(s => s.workoutLogId === realId)).toBe(true);
  });

  it('survives a lost response without filing the workout twice', async () => {
    /**
     * The case `clientId` exists for. The workout insert lands, the reply is
     * lost, and the phone cannot tell that from "never arrived" — so it
     * retries. Before the unique index, that produced the duplicate sessions
     * `finishActiveSession` still carries a comment about.
     */
    const h = await harness();
    h.api.setReachable(false);
    h.connectivity.reportUnreachable();

    await finishSession(h.repos, 12);

    h.api.setReachable(true);
    h.connectivity.reportReachable();
    h.api.swallowOne();               // the workout lands; the answer does not

    await h.flusher.flush();          // stops on the apparent failure
    h.connectivity.reportReachable();
    await h.flusher.flush();          // retries from the top

    expect(h.api.workouts).toHaveLength(1);
    expect(h.api.sets).toHaveLength(12);
    expect(await h.outbox.pendingCount()).toBe(0);
  });

  it('carries isCompleted, which server mode used to drop on the floor', async () => {
    // The client has always sent it and `workout_sets` had no column for it
    // until migration 008. Invisible until the cache started showing the
    // client's own copy back, at which point the card changed after a sync.
    const h = await harness();
    await finishSession(h.repos, 3);

    const posted = h.api.sets as unknown as { isCompleted: boolean }[];
    expect(posted.every(s => s.isCompleted === true)).toBe(true);
  });

  it('behaves exactly as before when there is signal', async () => {
    // No temp ids, no queue, one round trip per write — the online path is
    // untouched, which is the point of keeping the fast path at all.
    const h = await harness();

    const logId = await finishSession(h.repos, 5);

    expect(logId).not.toMatch(/^tmp_/);
    expect(await h.outbox.pendingCount()).toBe(0);
    expect(h.api.sets.every(s => s.workoutLogId === logId)).toBe(true);
  });

  it('keeps the session when the connection never comes back', async () => {
    // The queue is durable. Nothing here is allowed to quietly discard a
    // workout because the gym stayed offline all evening.
    const h = await harness();
    h.api.setReachable(false);
    h.connectivity.reportUnreachable();

    await finishSession(h.repos, 8);

    await h.flusher.flush();
    await h.flusher.flush();
    await h.flusher.flush();

    expect(await h.outbox.pendingCount()).toBe(9);
    expect(await h.outbox.failedCount()).toBe(0);
  });
});
