import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  adoptOrphanProfiles, guardBodyProfile, guardProfile, guardQueryProfile,
  guardRow, guardWorkoutSets, ownedProfileIds,
  guardActingProfile, guardBuddyLink, guardSharedSession, ownsStrict, requireUser,
  visibleProfileIds,
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

// ─── Social ──────────────────────────────────────────────────────────────────
//
// The guards above are allowed to let an anonymous request through; these are
// not. Everything below exists to pin that asymmetry, because it is the kind of
// difference that looks like an inconsistency and gets "fixed" by someone
// tidying up.

describe('requireUser', () => {
  it('refuses an anonymous request outright', async () => {
    // The deliberate inverse of guardProfile's "stays out of the way while
    // nobody is signed in". That concession exists so the app already on the
    // phone keeps working until AUTH_REQUIRED goes on; none of the social
    // routes predate accounts, so there is no older client to protect — and
    // here it would mean an anonymous caller reading two people's friendship.
    const result = await run(requireUser, reqFor(undefined));
    expect(result.passed).toBe(false);
    expect(result.status).toBe(401);
  });

  it('lets a signed-in request through', async () => {
    expect((await run(requireUser, reqFor({ id: 7 }))).passed).toBe(true);
  });
});

describe('ownsStrict', () => {
  it('refuses when nobody is signed in, where owns() would allow', async () => {
    const pool = fakePool([]);
    expect(await ownsStrict(pool, reqFor(undefined), '9')).toBe(false);
  });

  it('allows a profile you own', async () => {
    const pool = fakePool([OWNS_1_AND_2]);
    expect(await ownsStrict(pool, reqFor({ id: 7 }), '1')).toBe(true);
  });

  it('compares as strings, so a numeric id is not a way past it', async () => {
    const pool = fakePool([OWNS_1_AND_2]);
    expect(await ownsStrict(pool, reqFor({ id: 7 }), 1)).toBe(true);
  });
});

describe('guardActingProfile', () => {
  it('refuses a request that does not say which profile is acting', async () => {
    // Unlike guardBodyProfile, which leaves that to the handler: every social
    // route acts *as* one of your profiles, so one that names none cannot be
    // authorised at all.
    const pool = fakePool([]);
    const result = await run(guardActingProfile(pool), reqFor({ id: 7 }));
    expect(result.status).toBe(400);
  });

  it("refuses acting as somebody else's profile", async () => {
    const pool = fakePool([OWNS_1_AND_2]);
    const req = reqFor({ id: 7 }, { body: { profileId: '9' } });
    expect((await run(guardActingProfile(pool), req)).status).toBe(403);
  });

  it('reads the profile from the query string too', async () => {
    const pool = fakePool([OWNS_1_AND_2]);
    const req = reqFor({ id: 7 }, { query: { profileId: '1' } });
    expect((await run(guardActingProfile(pool), req)).passed).toBe(true);
  });
});

describe('guardBuddyLink', () => {
  const link = over => ['FROM buddy_links WHERE id', [{
    id: 5, profileIdA: '1', profileIdB: '9', blockedByProfileId: null,
    removedByA: null, removedByB: null, ...over,
  }]];

  it('lets through the side stored as A, and says which side that is', async () => {
    const pool = fakePool([OWNS_1_AND_2, link()]);
    const req = reqFor({ id: 7 }, { params: { linkId: '5' } });
    expect((await run(guardBuddyLink(pool), req)).passed).toBe(true);
    expect(req.link).toEqual({ id: '5', mine: '1', theirs: '9', isA: true });
  });

  it('lets through the side stored as B, with mine and theirs the other way up', async () => {
    // The case a two-directed-rows model would hide. Getting this backwards
    // sends a message signed as the other person.
    const pool = fakePool([OWNS_1_AND_2, link({ profileIdA: '9', profileIdB: '1' })]);
    const req = reqFor({ id: 7 }, { params: { linkId: '5' } });
    expect((await run(guardBuddyLink(pool), req)).passed).toBe(true);
    expect(req.link).toEqual({ id: '5', mine: '1', theirs: '9', isA: false });
  });

  it('closes the link once you have left, even though your row survives', async () => {
    // Leaving keeps the row so the other side keeps their transcript. It must
    // not keep the channel: a 404 here is what stops it being a friendship you
    // already ended.
    const pool = fakePool([OWNS_1_AND_2, link({ removedByA: new Date() })]);
    const req = reqFor({ id: 7 }, { params: { linkId: '5' } });
    expect((await run(guardBuddyLink(pool), req)).status).toBe(404);
  });

  it('closes the link when the other side left, so nobody writes into nothing', async () => {
    // The asymmetry that matters: your copy survives their departure, but the
    // channel does not, or you would be writing where nothing arrives.
    const pool = fakePool([OWNS_1_AND_2, link({ removedByB: new Date() })]);
    const req = reqFor({ id: 7 }, { params: { linkId: '5' } });
    expect((await run(guardBuddyLink(pool), req)).status).toBe(404);
  });

  it('refuses a friendship between two other people', async () => {
    const pool = fakePool([OWNS_1_AND_2, link({ profileIdA: '8', profileIdB: '9' })]);
    const req = reqFor({ id: 7 }, { params: { linkId: '5' } });
    expect((await run(guardBuddyLink(pool), req)).status).toBe(403);
  });

  it('answers 404 for a link that does not exist, not pass-through', async () => {
    // guardRow lets a missing row past so an idempotent DELETE stays idempotent.
    // Here the existence of link 431 is itself a fact about two other people,
    // and walking the id space collecting 403s would map out who knows whom.
    const pool = fakePool([['FROM buddy_links WHERE id', []]]);
    const req = reqFor({ id: 7 }, { params: { linkId: '431' } });
    const result = await run(guardBuddyLink(pool), req);
    expect(result.passed).toBe(false);
    expect(result.status).toBe(404);
  });

  it('refuses a blocked link from the side that was blocked', async () => {
    const pool = fakePool([OWNS_1_AND_2, link({ blockedByProfileId: '9' })]);
    const req = reqFor({ id: 7 }, { params: { linkId: '5' } });
    expect((await run(guardBuddyLink(pool), req)).status).toBe(403);
  });

  it('refuses a blocked link from the side that did the blocking', async () => {
    // Blocking is not one-way silence: the blocker stops being visible too, or
    // it would only mean "stop hearing from them" while still broadcasting.
    const pool = fakePool([OWNS_1_AND_2, link({ blockedByProfileId: '1' })]);
    const req = reqFor({ id: 7 }, { params: { linkId: '5' } });
    expect((await run(guardBuddyLink(pool), req)).status).toBe(403);
  });

  it('refuses an anonymous caller rather than resolving the link', async () => {
    const pool = fakePool([link()]);
    const req = reqFor(undefined, { params: { linkId: '5' } });
    expect((await run(guardBuddyLink(pool), req)).status).toBe(403);
  });

  it('never sends a non-numeric link id to Postgres', async () => {
    const pool = fakePool([]);
    const req = reqFor({ id: 7 }, { params: { linkId: "1 OR '1'='1" } });
    expect((await run(guardBuddyLink(pool), req)).status).toBe(404);
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('guardSharedSession', () => {
  /** A session on link 5, joined to its friendship exactly as the guard reads it. */
  const session = over => ['FROM shared_sessions s', [{
    sharedId: 12, sharedEndedAt: null,
    id: 5, linkId: 5, profileIdA: '1', profileIdB: '9', blockedByProfileId: null,
    removedByA: null, removedByB: null, ...over,
  }]];

  it('lets a side of the friendship through, without asking if they joined yet', async () => {
    // Joining is the whole point, and you cannot be a participant before you
    // join. Being a side of the link is the permission; participation is a
    // state within it.
    const pool = fakePool([session(), OWNS_1_AND_2]);
    const req = reqFor({ id: 7 }, { params: { sessionId: '12' } });

    expect((await run(guardSharedSession(pool), req)).passed).toBe(true);
    expect(req.shared).toEqual({
      id: '12', linkId: '5', ended: false, mine: '1', theirs: '9',
    });
  });

  it('keeps the session id apart from the link id', async () => {
    // `l.*` carries its own `id`, and a duplicate column in a join resolves to
    // the last one — which would leave every handler addressing the link by the
    // session's number.
    const pool = fakePool([session({ id: 5, linkId: 5 }), OWNS_1_AND_2]);
    const req = reqFor({ id: 7 }, { params: { sessionId: '12' } });
    await run(guardSharedSession(pool), req);

    expect(req.shared.id).toBe('12');
    expect(req.shared.linkId).toBe('5');
  });

  it('reports a finished session rather than refusing it', async () => {
    // Joining one is wrong and leaving one has to keep working, and a guard
    // cannot tell those apart — so it reports and the handler decides.
    const pool = fakePool([session({ sharedEndedAt: new Date() }), OWNS_1_AND_2]);
    const req = reqFor({ id: 7 }, { params: { sessionId: '12' } });

    expect((await run(guardSharedSession(pool), req)).passed).toBe(true);
    expect(req.shared.ended).toBe(true);
  });

  it('refuses a session between two other people', async () => {
    const pool = fakePool([session({ profileIdA: '8', profileIdB: '9' }), OWNS_1_AND_2]);
    const req = reqFor({ id: 7 }, { params: { sessionId: '12' } });
    expect((await run(guardSharedSession(pool), req)).status).toBe(403);
  });

  it('answers 404 for a session that does not exist', async () => {
    // Same reason as the link guard: the existence of session 87 is already a
    // fact about two other people.
    const pool = fakePool([['FROM shared_sessions s', []]]);
    const req = reqFor({ id: 7 }, { params: { sessionId: '87' } });
    expect((await run(guardSharedSession(pool), req)).status).toBe(404);
  });

  it('refuses once the friendship is blocked, from either side', async () => {
    const blocker = fakePool([session({ blockedByProfileId: '1' }), OWNS_1_AND_2]);
    const blocked = fakePool([session({ blockedByProfileId: '9' }), OWNS_1_AND_2]);

    expect((await run(guardSharedSession(blocker), reqFor({ id: 7 }, { params: { sessionId: '12' } }))).status).toBe(403);
    expect((await run(guardSharedSession(blocked), reqFor({ id: 7 }, { params: { sessionId: '12' } }))).status).toBe(403);
  });

  it('answers 404 once either side has left the friendship', async () => {
    const pool = fakePool([session({ removedByB: new Date() }), OWNS_1_AND_2]);
    const req = reqFor({ id: 7 }, { params: { sessionId: '12' } });
    expect((await run(guardSharedSession(pool), req)).status).toBe(404);
  });

  it('never sends a non-numeric session id to Postgres', async () => {
    const pool = fakePool([]);
    const req = reqFor({ id: 7 }, { params: { sessionId: "1 OR '1'='1" } });
    expect((await run(guardSharedSession(pool), req)).status).toBe(404);
    expect(pool.query).not.toHaveBeenCalled();
  });
});

describe('visibleProfileIds', () => {
  const links = rows => ['FROM buddy_links\n', rows];

  it('widens the owned set by the far side of each friendship', async () => {
    const pool = fakePool([OWNS_1_AND_2, links([{ profileIdA: '1', profileIdB: '9' }])]);
    const visible = await visibleProfileIds(pool, reqFor({ id: 7 }));
    expect([...visible].sort()).toEqual(['1', '2', '9']);
  });

  it('leaves out a buddy who is blocked', async () => {
    // The SQL filters them out; this pins that the filter is not optional.
    const pool = fakePool([OWNS_1_AND_2, links([])]);
    expect([...(await visibleProfileIds(pool, reqFor({ id: 7 })))].sort()).toEqual(['1', '2']);
  });

  it('gives an anonymous caller nothing to see', async () => {
    const pool = fakePool([]);
    expect(await visibleProfileIds(pool, reqFor(undefined))).toEqual([]);
  });

  it('asks the database once however many handlers ask', async () => {
    const pool = fakePool([OWNS_1_AND_2, links([])]);
    const req = reqFor({ id: 7 });
    await visibleProfileIds(pool, req);
    await visibleProfileIds(pool, req);
    // One for the owned profiles, one for the links — not two of each.
    expect(pool.query).toHaveBeenCalledTimes(2);
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
