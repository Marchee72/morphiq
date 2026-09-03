import { describe, expect, it, afterEach, vi } from 'vitest';

/**
 * Draining the queue, with the parent→child rewrite that makes it worth having.
 *
 * A workout logged offline is one insert plus N inserts that name its id — an
 * id that does not exist until the first one lands. Everything here is about
 * that: the order, the rewrite, and what happens when a link in the chain
 * cannot be made.
 */

const USER = { id: 1, email: 'marchee72@gmail.com', name: 'Marche', picture: null };
const P = '1';

interface Call { url: string; method: string; body: Record<string, unknown> }

/**
 * A server-mode module graph with a scripted `fetch`.
 *
 * `route` decides each response from the request; `calls` records what was
 * actually put on the wire, which is where the rewrite assertions look.
 */
async function harness(route: (call: Call) => Partial<Response> | Error) {
  vi.resetModules();
  vi.stubEnv('VITE_DB_TYPE', 'server');
  vi.stubEnv('VITE_API_URL', 'https://example.test');

  const calls: Call[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    const call: Call = {
      url,
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(init.body as string) : {},
    };
    calls.push(call);
    const result = route(call);
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
  await db.rows.clear();
  await db.ops.clear();
  await db.ids.clear();
  await db.meta.clear();

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

  return { repos, calls, flusher, outbox, connectivity, db };
}

const created = (id: string) => ({ ok: true, status: 201, json: async () => ({ id }) });
const noContent = () => ({ ok: true, status: 204, json: async () => undefined });
const errorStatus = (code: number) => ({ ok: false, status: code, json: async () => ({ error: `HTTP ${code}` }) });
const DEAD = new TypeError('Failed to fetch');

const workout = { profileId: P, type: 'strength', timestamp: new Date(), duration: 45, source: 'manual' as const, description: '3 sets' };
const measurement = {
  profileId: P, timestamp: new Date(), weight: 80,
  impedance: 500, bmi: 24, bmr: 1700, bodyFat: 15, bodyWater: 60, boneMass: 3, muscleMass: 65,
};
const set = (n: number) => ({ profileId: P, workoutLogId: '', exerciseName: 'Squat', setNumber: n, reps: 5, weight: 100, timestamp: new Date() });

afterEach(async () => {
  const { resetFlusher } = await import('../flusher');
  resetFlusher();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('the parent→child rewrite', () => {
  it('replaces the temp workout id in every set before sending it', async () => {
    let online = false;
    const h = await harness(call => {
      if (!online) return DEAD;
      if (call.url.includes('/workout-logs')) return created('42');
      return created('900');
    });

    // Offline: the workout gets a temp id and the sets carry it.
    const logId = await h.repos.workout.add(workout);
    expect(logId).toMatch(/^tmp_/);
    for (const n of [1, 2, 3]) {
      await h.repos.workoutSet.add({ ...set(n), workoutLogId: logId });
    }

    online = true;
    h.connectivity.reportReachable();
    h.calls.length = 0;
    await h.flusher.flush();

    const setCalls = h.calls.filter(c => c.url.includes('/workout-sets'));
    expect(setCalls).toHaveLength(3);
    for (const call of setCalls) {
      // The whole point: a temp id reaching the server would skip `guardRow`
      // and then 500 on `WHERE id = 'tmp_…'`.
      expect(call.body.workoutLogId).toBe('42');
    }
    expect(await h.outbox.pendingCount()).toBe(0);
  });

  it('sends the workout before any of its sets', async () => {
    let online = false;
    const h = await harness(call => {
      if (!online) return DEAD;
      return created(call.url.includes('/workout-logs') ? '42' : '900');
    });

    const logId = await h.repos.workout.add(workout);
    await Promise.all([1, 2, 3].map(n => h.repos.workoutSet.add({ ...set(n), workoutLogId: logId })));

    online = true;
    h.connectivity.reportReachable();
    h.calls.length = 0;
    await h.flusher.flush();

    expect(h.calls[0].url).toContain('/workout-logs');
  });

  it('re-files the cached rows under the real id, so nothing blinks out', async () => {
    let online = false;
    const h = await harness(call => {
      if (!online) return DEAD;
      return created(call.url.includes('/workout-logs') ? '42' : '900');
    });

    const logId = await h.repos.workout.add(workout);
    await h.repos.workoutSet.add({ ...set(1), workoutLogId: logId });

    online = true;
    h.connectivity.reportReachable();
    await h.flusher.flush();

    // Left under the temp key, the next complete read would delete these as
    // stale and the session would vanish from the screen mid-sync.
    const rows = await h.db.rows.where('kind').equals('workoutLog').toArray();
    expect(rows.map(r => r.data.id)).toEqual(['42']);

    const sets = await h.db.rows.where('kind').equals('workoutSet').toArray();
    expect(sets[0].data.workoutLogId).toBe('42');
  });

  it('tells its listeners what the server called the row', async () => {
    let online = false;
    const h = await harness(() => (online ? created('42') : DEAD));

    const resolved = vi.fn();
    h.flusher.onIdResolved(resolved);

    const logId = await h.repos.workout.add(workout);
    online = true;
    h.connectivity.reportReachable();
    await h.flusher.flush();

    expect(resolved).toHaveBeenCalledWith('workoutLog', logId, '42');
  });
});

describe('idempotency', () => {
  it('sends the same clientId on a replay, so the server can recognise it', async () => {
    /**
     * The failure this defends against: the request lands, the response is lost,
     * the phone retries. Without a key chosen before the first send, that files
     * the workout twice — a bug `finishActiveSession` documents having reached
     * production.
     */
    let online = false;
    let dropResponse = true;
    const h = await harness(() => {
      if (!online) return DEAD;
      if (dropResponse) { dropResponse = false; return DEAD; }  // landed, answer lost
      return created('42');
    });

    await h.repos.workout.add(workout);   // optimistic attempt, then queued
    online = true;
    h.connectivity.reportReachable();

    await h.flusher.flush();          // "fails" — but the server saw it
    h.connectivity.reportReachable();
    await h.flusher.flush();          // retries

    const posts = h.calls.filter(c => c.url.includes('/workout-logs') && c.method === 'POST');
    // Three attempts at one workout: the optimistic send, the lost-response
    // send, and the retry. Every one of them has to carry the same key — the
    // key is minted before the first attempt precisely so the first attempt is
    // covered too. `ON CONFLICT (profileId, clientId)` collapses all three.
    expect(posts).toHaveLength(3);
    expect(posts[0].body.clientId).toBeTruthy();
    expect(new Set(posts.map(p => p.body.clientId)).size).toBe(1);
  });

  it('mints a fresh key for a genuinely new row', async () => {
    // `linkPendingRoutineToWorkout` re-inserts rows it has just read back, so a
    // reused key would collide with the row being replaced.
    const h = await harness(() => created('1'));

    await h.repos.workout.add(workout);
    await h.repos.workout.add(workout);

    const posts = h.calls.filter(c => c.method === 'POST');
    expect(posts[0].body.clientId).not.toBe(posts[1].body.clientId);
  });

  it('never sends an id the client invented', async () => {
    const h = await harness(() => created('1'));
    await h.repos.workout.add({ ...workout, id: 'tmp_leaked' });

    expect(h.calls[0].body.id).toBeUndefined();
  });
});

describe('failure handling', () => {
  it('gives up on a write the server refuses and carries on with the rest', async () => {
    let online = false;
    const h = await harness(call => {
      if (!online) return DEAD;
      if (call.url.includes('/workout-logs')) return errorStatus(400);
      return created('7');
    });

    await h.repos.workout.add(workout);
    await h.repos.measurement.save(measurement);

    online = true;
    h.connectivity.reportReachable();
    await h.flusher.flush();

    // One poisoned op must not hold the queue hostage — but it is kept, so the
    // user can be told a change of theirs did not make it.
    expect(await h.outbox.failedCount()).toBe(1);
    expect(await h.outbox.pendingCount()).toBe(0);
    expect(h.calls.some(c => c.url.includes('/measurements'))).toBe(true);
  });

  it('fails a workout\'s sets with the workout, rather than orphaning them', async () => {
    let online = false;
    const h = await harness(call => {
      if (!online) return DEAD;
      if (call.url.includes('/workout-logs')) return errorStatus(400);
      return created('7');
    });

    const logId = await h.repos.workout.add(workout);
    await h.repos.workoutSet.add({ ...set(1), workoutLogId: logId });

    online = true;
    h.connectivity.reportReachable();
    await h.flusher.flush();

    // The set can never resolve its parent, and FIFO means it would block
    // everything behind it forever.
    expect(await h.outbox.pendingCount()).toBe(0);
    expect(h.calls.some(c => c.url.includes('/workout-sets'))).toBe(false);
  });

  it('stops but keeps everything when the session expires', async () => {
    /**
     * These are still the user's writes. Discarding a workout because a token
     * expired would lose it for a reason that has nothing to do with the
     * workout — and signing back in is exactly what is about to happen.
     */
    let online = false;
    const h = await harness(() => (online ? errorStatus(401) : DEAD));

    await h.repos.workout.add(workout);
    online = true;
    h.connectivity.reportReachable();
    await h.flusher.flush();

    expect(await h.outbox.pendingCount()).toBe(1);
    expect(await h.outbox.failedCount()).toBe(0);
  });

  it('stops at the first unreachable op instead of burning through the queue', async () => {
    const h = await harness(() => DEAD);

    await h.repos.workout.add(workout);
    await h.repos.measurement.save(measurement);

    h.connectivity.reportReachable();
    h.calls.length = 0;
    await h.flusher.flush();

    // One attempt, not one per queued op: the network is gone, and the second
    // would only fail the same way.
    expect(h.calls).toHaveLength(1);
    expect(await h.outbox.pendingCount()).toBe(2);
  });
});

describe('ordering against the fast path', () => {
  it('queues a write rather than sending it past something already waiting', async () => {
    /**
     * The invariant behind `hasPending`. `linkPendingRoutineToWorkout` deletes
     * a workout's sets and then re-inserts them; if the re-inserts went direct
     * while the delete was still queued, the delete would land afterwards and
     * remove the rows it was meant to replace.
     */
    let online = false;
    const h = await harness(() => (online ? created('9') : DEAD));

    await h.repos.workout.add(workout);        // queued: network is down

    online = true;                             // network is back…
    h.connectivity.reportReachable();
    const second = await h.repos.measurement.save(measurement);

    // …but something is still ahead of it, so it waits its turn.
    expect(second).toMatch(/^tmp_/);
    expect(await h.outbox.pendingCount()).toBe(2);
  });

  it('goes straight through when the queue is empty', async () => {
    const h = await harness(() => created('42'));
    const id = await h.repos.workout.add(workout);

    // No behaviour change online: `finishActiveSession` gets a real id back on
    // the first call, exactly as before any of this existed.
    expect(id).toBe('42');
    expect(await h.outbox.pendingCount()).toBe(0);
  });
});

describe('deletes', () => {
  it('never puts a temp id in a request path', async () => {
    let online = false;
    const h = await harness(() => (online ? noContent() : DEAD));

    const id = await h.repos.workout.add(workout);
    await h.repos.workout.delete(id);

    online = true;
    h.connectivity.reportReachable();
    h.calls.length = 0;
    await h.flusher.flush();

    // Created and deleted before either reached the server: the right number of
    // requests is zero, and it is also the only safe number.
    expect(h.calls).toHaveLength(0);
    expect(await h.outbox.pendingCount()).toBe(0);
  });

  it('takes the cached sets down with a deleted workout', async () => {
    const h = await harness(call =>
      (call.method === 'POST' ? created(call.url.includes('/workout-logs') ? '42' : '900') : noContent()));

    const logId = await h.repos.workout.add(workout);
    await h.repos.workoutSet.add({ ...set(1), workoutLogId: logId });
    await h.repos.workout.delete(logId);

    // The server deletes both in one transaction; a cache that kept the sets
    // would show them under a session that no longer exists.
    expect(await h.db.rows.where('kind').equals('workoutSet').count()).toBe(0);
  });
});
