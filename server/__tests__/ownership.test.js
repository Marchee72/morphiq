import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  adoptOrphanProfiles, guardBodyProfile, guardProfile, guardQueryProfile,
  guardRow, guardWorkoutSets, ownedProfileIds,
} from '../auth.js';

/**
 * The guards that keep two users' data apart.
 *
 * These are the only thing between "signed in" and "signed in as the right
 * person": every table hangs off a numeric `profileId`, so without them a user
 * with a valid session could read and delete anyone's history by counting
 * upwards. Each case here is a request that used to succeed.
 *
 * The pool is faked rather than mocked against a real Postgres — the SQL these
 * guards issue is two fixed lookups, and what is worth pinning is the decision,
 * not the driver.
 */

/** A pool that answers each query from the first matching pattern. */
function fakePool(answers) {
  return {
    query: vi.fn(async (sql, params) => {
      for (const [pattern, rows] of answers) {
        if (sql.includes(pattern)) {
          return { rows: typeof rows === 'function' ? rows(params) : rows };
        }
      }
      throw new Error(`Unexpected query: ${sql}`);
    }),
  };
}

/** Alice owns profiles 1 and 2. Bob owns 9. */
const OWNS_1_AND_2 = ['FROM user_profiles WHERE user_id', [{ id: 1 }, { id: 2 }]];

function reqFor(user, over = {}) {
  return { user, params: {}, body: {}, query: {}, ...over };
}

function resSpy() {
  const res = {
    statusCode: null,
    payload: null,
    status(code) { res.statusCode = code; return res; },
    json(body) { res.payload = body; return res; },
  };
  return res;
}

/** Runs a guard and reports whether it let the request through. */
async function run(guard, req) {
  const res = resSpy();
  let passed = false;
  await guard(req, res, () => { passed = true; });
  return { passed, status: res.statusCode, body: res.payload };
}

describe('ownedProfileIds', () => {
  it('asks the database once however many guards run on a request', async () => {
    const pool = fakePool([OWNS_1_AND_2]);
    const req = reqFor({ id: 7 });

    await ownedProfileIds(pool, req);
    await ownedProfileIds(pool, req);
    await ownedProfileIds(pool, req);

    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  it('returns ids as strings, because every profileId column is TEXT', async () => {
    const pool = fakePool([OWNS_1_AND_2]);
    expect(await ownedProfileIds(pool, reqFor({ id: 7 }))).toEqual(['1', '2']);
  });
});

describe('guardProfile', () => {
  it('lets a user reach their own profile', async () => {
    const pool = fakePool([OWNS_1_AND_2]);
    const req = reqFor({ id: 7 }, { params: { profileId: '2' } });
    expect((await run(guardProfile(pool), req)).passed).toBe(true);
  });

  it("refuses somebody else's profile", async () => {
    const pool = fakePool([OWNS_1_AND_2]);
    const req = reqFor({ id: 7 }, { params: { profileId: '9' } });
    const result = await run(guardProfile(pool), req);
    expect(result.passed).toBe(false);
    expect(result.status).toBe(403);
  });

  it('stays out of the way while nobody is signed in', async () => {
    // The staged rollout depends on this: the API has to keep serving the app
    // already installed on the phone until AUTH_REQUIRED goes on.
    const pool = fakePool([]);
    const req = reqFor(undefined, { params: { profileId: '9' } });
    expect((await run(guardProfile(pool), req)).passed).toBe(true);
  });
});

describe('guardBodyProfile', () => {
  it("refuses a write aimed at another user's profile", async () => {
    // `POST /api/measurements` names its profile in the body, so the path guard
    // never sees it — this used to write into anyone's history.
    const pool = fakePool([OWNS_1_AND_2]);
    const req = reqFor({ id: 7 }, { body: { profileId: '9', weight: 80 } });
    expect((await run(guardBodyProfile(pool), req)).status).toBe(403);
  });

  it('allows a write to your own profile', async () => {
    const pool = fakePool([OWNS_1_AND_2]);
    const req = reqFor({ id: 7 }, { body: { profileId: '1', weight: 80 } });
    expect((await run(guardBodyProfile(pool), req)).passed).toBe(true);
  });

  it('leaves a body with no profileId to the handler', async () => {
    // Failing it here would answer 403 to what is really a malformed request.
    const pool = fakePool([OWNS_1_AND_2]);
    expect((await run(guardBodyProfile(pool), reqFor({ id: 7 }))).passed).toBe(true);
  });

  it('compares as strings, so a numeric id is not a way past it', async () => {
    const pool = fakePool([OWNS_1_AND_2]);
    const req = reqFor({ id: 7 }, { body: { profileId: 1 } });
    expect((await run(guardBodyProfile(pool), req)).passed).toBe(true);
  });
});

describe('guardQueryProfile', () => {
  it("refuses deleting another user's favourite", async () => {
    const pool = fakePool([OWNS_1_AND_2]);
    const req = reqFor({ id: 7 }, { query: { profileId: '9', exerciseId: '0025' } });
    expect((await run(guardQueryProfile(pool), req)).status).toBe(403);
  });
});

describe('guardRow', () => {
  const rowOwnedBy = profileId => ['FROM measurements WHERE id', [{ profileId }]];

  it("refuses a row belonging to someone else's profile", async () => {
    const pool = fakePool([OWNS_1_AND_2, rowOwnedBy('9')]);
    const req = reqFor({ id: 7 }, { params: { id: '431' } });
    expect((await run(guardRow(pool, 'measurements'), req)).status).toBe(403);
  });

  it('allows a row on your own profile', async () => {
    const pool = fakePool([OWNS_1_AND_2, rowOwnedBy('1')]);
    const req = reqFor({ id: 7 }, { params: { id: '431' } });
    expect((await run(guardRow(pool, 'measurements'), req)).passed).toBe(true);
  });

  it('passes a row that does not exist through to the handler', async () => {
    // There is nothing to leak, and answering 403 would turn today's idempotent
    // DELETE into an error the client does not expect.
    const pool = fakePool([OWNS_1_AND_2, ['FROM measurements WHERE id', []]]);
    const req = reqFor({ id: 7 }, { params: { id: '999999' } });
    expect((await run(guardRow(pool, 'measurements'), req)).passed).toBe(true);
  });

  it('never sends a non-numeric id to Postgres', async () => {
    // The id columns are SERIAL; `WHERE id = 'abc'` raises an invalid-input
    // error rather than matching nothing, which would surface as a 500.
    const pool = fakePool([OWNS_1_AND_2]);
    const req = reqFor({ id: 7 }, { params: { id: "1 OR '1'='1" } });
    const result = await run(guardRow(pool, 'measurements'), req);
    expect(result.passed).toBe(true);
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('guardWorkoutSets', () => {
  it("refuses to read the sets of somebody else's session", async () => {
    const pool = fakePool([
      OWNS_1_AND_2,
      ['FROM workout_sets WHERE "workoutLogId"', [{ profileId: '9' }]],
    ]);
    const req = reqFor({ id: 7 }, { params: { workoutLogId: '55' } });
    expect((await run(guardWorkoutSets(pool), req)).status).toBe(403);
  });

  it('allows your own session', async () => {
    const pool = fakePool([
      OWNS_1_AND_2,
      ['FROM workout_sets WHERE "workoutLogId"', [{ profileId: '1' }]],
    ]);
    const req = reqFor({ id: 7 }, { params: { workoutLogId: '55' } });
    expect((await run(guardWorkoutSets(pool), req)).passed).toBe(true);
  });

  it('accepts a non-numeric log id without erroring, since the column is TEXT', async () => {
    const pool = fakePool([OWNS_1_AND_2, ['FROM workout_sets WHERE "workoutLogId"', []]]);
    const req = reqFor({ id: 7 }, { params: { workoutLogId: 'pending' } });
    expect((await run(guardWorkoutSets(pool), req)).passed).toBe(true);
  });
});

describe('adoptOrphanProfiles', () => {
  const pool = () => ({ query: vi.fn(async () => ({ rowCount: 3, rows: [] })) });

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    delete process.env.OWNER_EMAIL;
    vi.restoreAllMocks();
  });

  it('gives the pre-account profiles to the configured owner', async () => {
    process.env.OWNER_EMAIL = 'marchee72@gmail.com';
    expect(await adoptOrphanProfiles(pool(), 1, 'marchee72@gmail.com')).toBe(3);
  });

  it('ignores case and stray whitespace in the address', async () => {
    process.env.OWNER_EMAIL = '  MarcHee72@Gmail.com ';
    expect(await adoptOrphanProfiles(pool(), 1, 'marchee72@gmail.com')).toBe(3);
  });

  it('gives a stranger nothing, however early they sign in', async () => {
    // The rule used to be "whoever signs in first". Sharing the URL under that
    // rule hands the owner's entire history to the first person who opens it.
    process.env.OWNER_EMAIL = 'marchee72@gmail.com';
    const db = pool();
    expect(await adoptOrphanProfiles(db, 2, 'someone.else@gmail.com')).toBe(0);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('adopts nothing at all when no owner is configured', async () => {
    const db = pool();
    expect(await adoptOrphanProfiles(db, 1, 'marchee72@gmail.com')).toBe(0);
    expect(db.query).not.toHaveBeenCalled();
  });

  it('does not adopt for a sign-in that carries no email', async () => {
    process.env.OWNER_EMAIL = 'marchee72@gmail.com';
    expect(await adoptOrphanProfiles(pool(), 1, null)).toBe(0);
  });
});
