import { describe, expect, it, vi } from 'vitest';
import { socialRoutes } from '../social.js';

/**
 * Redemption: the one route here that a stranger can reach with a guess.
 *
 * The guards in `ownership.test.js` decide who may touch an existing
 * friendship. These decide who may *create* one, which is a different question
 * and the one an invite code exists to answer. Each case below is either a way
 * to spend somebody's code without becoming their partner, or a way to learn
 * something about codes you do not have.
 *
 * The router is driven directly rather than over HTTP: what is worth pinning is
 * the decision and the order the checks run in, not Express's routing.
 */

/** A pool that answers each query from the first matching pattern. */
function fakePool(answers) {
  return {
    query: vi.fn(async (sql, params) => {
      for (const [pattern, rows] of answers) {
        if (sql.includes(pattern)) {
          // The sql is handed along too: some routes carry the decision in the
          // statement rather than the parameters — a literal column name, or a
          // kind spelled into the VALUES list.
          return { rows: typeof rows === 'function' ? rows(params, sql) : rows };
        }
      }
      throw new Error(`Unexpected query: ${sql}`);
    }),
  };
}

const OWNS_1_AND_2 = ['FROM user_profiles WHERE user_id', [{ id: 1 }, { id: 2 }]];
const NO_ATTEMPTS = ['FROM social_attempts', [{ n: 0 }]];
const RECORD_ATTEMPT = ['INSERT INTO social_attempts', []];
const NO_BUDDIES = ['COUNT(*)::int AS n FROM buddy_links', [{ n: 0 }]];
const NO_EXISTING_LINK = ['FROM buddy_links l', []];

const HOUR = 3600_000;

/** An invitation minted by user 42, whose profile is 9. */
function invite(over = {}) {
  return ['FROM buddy_invites WHERE code', [{
    id: 1,
    code: 'ABCD2345',
    inviterUserId: 42,
    inviterProfileId: '9',
    expiresAt: new Date(Date.now() + HOUR),
    redeemedAt: null,
    revokedAt: null,
    ...over,
  }]];
}

/** Drives one request through the router and reports what came back. */
function call(pool, { method, url, body = {}, query = {}, user = { id: 7 } }) {
  const router = socialRoutes(pool);
  return new Promise((resolve, reject) => {
    const req = { method, url, body, query, user, headers: {} };
    const res = {
      statusCode: 200,
      status(code) { res.statusCode = code; return res; },
      json(payload) { resolve({ status: res.statusCode, body: payload }); return res; },
      end() { resolve({ status: res.statusCode, body: undefined }); return res; },
    };
    router(req, res, err => (err ? reject(err) : resolve({ status: 404, body: null })));
  });
}

const redeem = (pool, over = {}) => call(pool, {
  method: 'POST', url: '/invites/ABCD2345/redeem', body: { profileId: '1' }, ...over,
});

describe('POST /invites/:code/redeem', () => {
  it('creates the friendship with the pair in canonical order', async () => {
    const created = {
      id: 5, profileIdA: '1', profileIdB: '9', createdAt: new Date(),
      blockedByProfileId: null, buddyName: 'Ana',
    };
    let inserted = null;
    const pool = fakePool([
      OWNS_1_AND_2,
      NO_ATTEMPTS,
      RECORD_ATTEMPT,
      invite(),
      ['UPDATE buddy_invites', [{ code: 'ABCD2345' }]],
      ['INSERT INTO buddy_links', params => { inserted = params; return []; }],
      NO_BUDDIES,
      // First call finds nothing, the read-back after the insert finds the row.
      ['FROM buddy_links l', () => (inserted ? [created] : [])],
    ]);

    const result = await redeem(pool);

    expect(result.status).toBe(201);
    expect(result.body.buddyProfileId).toBe('9');
    expect(result.body.buddyName).toBe('Ana');
    // 1 before 9 whichever way round the two people arrived.
    expect(inserted.slice(0, 2)).toEqual(['1', '9']);
  });

  it('refuses your own code', async () => {
    // Not an attack, just the obvious mistake — and on an account with two
    // profiles it would otherwise befriend you to yourself.
    const pool = fakePool([
      OWNS_1_AND_2, NO_ATTEMPTS, RECORD_ATTEMPT,
      invite({ inviterUserId: 7 }),
    ]);
    expect((await redeem(pool)).status).toBe(400);
  });

  it('does not spend the code on a request it is going to refuse', async () => {
    // Claiming is what burns a code. Refusing after the claim would leave the
    // inviter's code spent on a friendship that never happened.
    const pool = fakePool([
      OWNS_1_AND_2, NO_ATTEMPTS, RECORD_ATTEMPT,
      invite({ inviterUserId: 7 }),
    ]);
    await redeem(pool);
    const claimed = pool.query.mock.calls.some(([sql]) => sql.includes('UPDATE buddy_invites'));
    expect(claimed).toBe(false);
  });

  it('answers an expired code exactly as it answers an unknown one', async () => {
    // Telling the two apart tells someone guessing which guesses were real
    // codes, which is the only thing that makes guessing worth doing.
    const expired = fakePool([
      OWNS_1_AND_2, NO_ATTEMPTS, RECORD_ATTEMPT,
      invite({ expiresAt: new Date(Date.now() - HOUR) }),
    ]);
    const unknown = fakePool([
      OWNS_1_AND_2, NO_ATTEMPTS, RECORD_ATTEMPT,
      ['FROM buddy_invites WHERE code', []],
    ]);

    expect(await redeem(expired)).toEqual(await redeem(unknown));
    expect((await redeem(expired)).status).toBe(404);
  });

  it('refuses a code somebody already used', async () => {
    const pool = fakePool([
      OWNS_1_AND_2, NO_ATTEMPTS, RECORD_ATTEMPT,
      invite({ redeemedAt: new Date() }),
    ]);
    expect((await redeem(pool)).status).toBe(404);
  });

  it('refuses a code that was withdrawn', async () => {
    const pool = fakePool([
      OWNS_1_AND_2, NO_ATTEMPTS, RECORD_ATTEMPT,
      invite({ revokedAt: new Date() }),
    ]);
    expect((await redeem(pool)).status).toBe(404);
  });

  it('stops after too many tries in an hour', async () => {
    // Guessing is impractical at 6.6e11 codes; this is what stops trying anyway.
    // Counted in a table because two serverless invocations share no memory.
    const pool = fakePool([
      OWNS_1_AND_2,
      ['FROM social_attempts', [{ n: 10 }]],
    ]);
    expect((await redeem(pool)).status).toBe(429);
  });

  it('is idempotent when the two are already partners, without spending the code', async () => {
    // Nothing happened, so nothing is consumed.
    const existing = {
      id: 5, profileIdA: '1', profileIdB: '9', createdAt: new Date(),
      blockedByProfileId: null, removedByA: null, removedByB: null, buddyName: 'Ana',
    };
    const pool = fakePool([
      OWNS_1_AND_2, NO_ATTEMPTS, RECORD_ATTEMPT,
      invite(),
      ['FROM buddy_links l', [existing]],
    ]);

    const result = await redeem(pool);

    expect(result.status).toBe(200);
    expect(result.body.id).toBe('5');
    expect(pool.query.mock.calls.some(([sql]) => sql.includes('UPDATE buddy_invites'))).toBe(false);
  });

  it('revives a friendship one of them had left', async () => {
    // The UNIQUE constraint means the abandoned row is still there. Both have
    // now said otherwise — one minted a code, the other redeemed it — so it
    // comes back rather than being permanently in the way.
    const abandoned = {
      id: 5, profileIdA: '1', profileIdB: '9', createdAt: new Date(),
      blockedByProfileId: null, removedByA: new Date(), removedByB: null, buddyName: 'Ana',
    };
    let revived = false;
    const pool = fakePool([
      OWNS_1_AND_2, NO_ATTEMPTS, RECORD_ATTEMPT,
      invite(),
      ['UPDATE buddy_invites', [{ code: 'ABCD2345' }]],
      ['SET "removedByA" = NULL', () => { revived = true; return []; }],
      ['FROM buddy_links l', () => [revived ? { ...abandoned, removedByA: null } : abandoned]],
    ]);

    const result = await redeem(pool);

    expect(result.status).toBe(201);
    expect(revived).toBe(true);
  });

  it('spends the code when it revives, unlike the idempotent case', async () => {
    // Reviving is a real outcome. Leaving the code live would let it be used
    // again on a friendship that already came back.
    const abandoned = {
      id: 5, profileIdA: '1', profileIdB: '9', createdAt: new Date(),
      blockedByProfileId: null, removedByA: new Date(), removedByB: null, buddyName: 'Ana',
    };
    const pool = fakePool([
      OWNS_1_AND_2, NO_ATTEMPTS, RECORD_ATTEMPT,
      invite(),
      ['UPDATE buddy_invites', [{ code: 'ABCD2345' }]],
      ['SET "removedByA" = NULL', []],
      ['FROM buddy_links l', [abandoned]],
    ]);

    await redeem(pool);

    expect(pool.query.mock.calls.some(([sql]) => sql.includes('UPDATE buddy_invites'))).toBe(true);
  });

  it('refuses to act as a profile that is not yours', async () => {
    const pool = fakePool([OWNS_1_AND_2]);
    const result = await redeem(pool, { body: { profileId: '9' } });
    expect(result.status).toBe(403);
  });
});

describe('POST /invites', () => {
  it('withdraws the previous code before minting a new one', async () => {
    // Otherwise "generate a new one" — which people press precisely because
    // they want the old code dead — leaves it alive until it expires.
    const order = [];
    const pool = fakePool([
      OWNS_1_AND_2,
      NO_BUDDIES,
      ['UPDATE buddy_invites SET "revokedAt"', () => { order.push('revoke'); return []; }],
      ['INSERT INTO buddy_invites', () => {
        order.push('mint');
        return [{ code: 'WXYZ6789', createdAt: new Date(), expiresAt: new Date() }];
      }],
    ]);

    const result = await call(pool, { method: 'POST', url: '/invites', body: { profileId: '1' } });

    expect(result.status).toBe(201);
    expect(result.body.code).toBe('WXYZ6789');
    expect(order).toEqual(['revoke', 'mint']);
  });

  it('never returns who the code belongs to', async () => {
    // The code travels through WhatsApp; it must carry no account details.
    const pool = fakePool([
      OWNS_1_AND_2, NO_BUDDIES,
      ['UPDATE buddy_invites SET "revokedAt"', []],
      ['INSERT INTO buddy_invites', [{
        code: 'WXYZ6789', createdAt: new Date(), expiresAt: new Date(),
        inviterUserId: 7, inviterProfileId: '1',
      }]],
    ]);

    const { body } = await call(pool, { method: 'POST', url: '/invites', body: { profileId: '1' } });

    expect(Object.keys(body).sort()).toEqual(['code', 'createdAt', 'expiresAt']);
  });

  it('refuses once the partner ceiling is reached', async () => {
    const pool = fakePool([
      OWNS_1_AND_2,
      ['COUNT(*)::int AS n FROM buddy_links', [{ n: 20 }]],
    ]);
    const result = await call(pool, { method: 'POST', url: '/invites', body: { profileId: '1' } });
    expect(result.status).toBe(409);
  });
});

describe('GET /buddies', () => {
  it('reports which side blocked, not merely that someone did', async () => {
    // The UI offers "unblock" only to the person who blocked, so a single
    // boolean would let the blocked side lift their own block.
    const pool = fakePool([
      OWNS_1_AND_2,
      ['FROM buddy_links l', [
        { id: 5, profileIdA: '1', profileIdB: '9', createdAt: new Date(), blockedByProfileId: '1' },
        { id: 6, profileIdA: '8', profileIdB: '1', createdAt: new Date(), blockedByProfileId: '8' },
      ]],
    ]);

    const { body } = await call(pool, { method: 'GET', url: '/buddies', query: { profileId: '1' } });

    expect(body[0]).toMatchObject({ buddyProfileId: '9', blockedByMe: true, blockedByThem: false });
    expect(body[1]).toMatchObject({ buddyProfileId: '8', blockedByMe: false, blockedByThem: true });
  });
});

describe('DELETE /buddies/:linkId', () => {
  const LIVE_LINK = {
    id: 5, profileIdA: '1', profileIdB: '9', blockedByProfileId: null,
    removedByA: null, removedByB: null,
  };

  /** Records what the route did, so the test can assert on the decision. */
  function leavingPool(afterUpdate, link = LIVE_LINK) {
    const seen = { update: null, cleared: null, deleted: false, closedShared: false };
    const pool = {
      seen,
      query: async (sql, params) => {
        if (sql.includes('FROM user_profiles WHERE user_id')) return { rows: [{ id: 1 }, { id: 2 }] };
        if (sql.includes('SELECT * FROM buddy_links WHERE id')) return { rows: [link] };
        if (sql.includes('UPDATE shared_sessions')) {
          seen.closedShared = true;
          return { rows: [] };
        }
        if (sql.includes('UPDATE live_sessions')) return { rows: [] };
        if (sql.includes('INSERT INTO buddy_read_marks')) {
          seen.cleared = params;
          return { rows: [] };
        }
        if (sql.includes('UPDATE buddy_links SET')) {
          seen.update = sql;
          return { rows: [afterUpdate] };
        }
        if (sql.includes('DELETE FROM buddy_links')) { seen.deleted = true; return { rows: [] }; }
        throw new Error(`Unexpected query: ${sql}`);
      },
    };
    return pool;
  }

  it('clears your own transcript by cursor before it marks you gone', async () => {
    // The cursor is how "only your copy" is actually enforced. Setting it after
    // the link closed would race the guard that then refuses the link.
    const pool = leavingPool({ id: 5, removedByA: new Date(), removedByB: null });

    await call(pool, { method: 'DELETE', url: '/buddies/5' });

    expect(pool.seen.cleared).toEqual(['5', '1']);
  });

  it('marks your side rather than deleting the row', async () => {
    // A DELETE cascades, and would take the other person's transcript with
    // yours. Their copy is theirs; leaving must not reach across and burn it.
    const pool = leavingPool({ id: 5, removedByA: new Date(), removedByB: null });

    const result = await call(pool, { method: 'DELETE', url: '/buddies/5' });

    expect(result.status).toBe(204);
    expect(pool.seen.update).toContain('removedByA');
    expect(pool.seen.deleted).toBe(false);
  });

  it('marks the B column when you are the B side', async () => {
    const pool = leavingPool(
      { id: 5, removedByA: null, removedByB: new Date() },
      { ...LIVE_LINK, profileIdA: '9', profileIdB: '1' },
    );

    await call(pool, { method: 'DELETE', url: '/buddies/5' });

    expect(pool.seen.update).toContain('removedByB');
  });

  it('collects the row only once both sides have left', async () => {
    // At that point nobody can reach any of it, so there is nothing to keep.
    const pool = leavingPool({ id: 5, removedByA: new Date(), removedByB: new Date() });

    await call(pool, { method: 'DELETE', url: '/buddies/5' });

    expect(pool.seen.deleted).toBe(true);
  });

  it('closes any shared session open on the friendship', async () => {
    // The friendship is what authorises reaching a shared session, so leaving it
    // while one is open would strand whoever is still inside: they could no
    // longer be let out of a room they cannot reach.
    const pool = leavingPool({ id: 5, removedByA: new Date(), removedByB: null });

    await call(pool, { method: 'DELETE', url: '/buddies/5' });

    expect(pool.seen.closedShared).toBe(true);
  });
});

describe('messages', () => {
  const LIVE_LINK = {
    id: 5, profileIdA: '1', profileIdB: '9', blockedByProfileId: null,
    removedByA: null, removedByB: null,
  };

  function chatPool(handlers = {}) {
    const seen = { insert: null, selectParams: null };
    return {
      seen,
      query: async (sql, params) => {
        if (sql.includes('FROM user_profiles WHERE user_id')) return { rows: [{ id: 1 }, { id: 2 }] };
        if (sql.includes('SELECT * FROM buddy_links WHERE id')) return { rows: [LIVE_LINK] };
        if (sql.includes('"clearedBeforeMessageId" FROM buddy_read_marks')) {
          return { rows: handlers.marks ?? [] };
        }
        if (sql.includes('FROM buddy_messages')) {
          seen.selectParams = params;
          return { rows: handlers.messages ?? [] };
        }
        if (sql.includes('INSERT INTO buddy_messages')) {
          seen.insert = params;
          return { rows: [{
            id: 7, linkId: 5, senderProfileId: params[1], kind: params[2],
            body: params[3], payload: null, createdAt: new Date(),
          }] };
        }
        throw new Error(`Unexpected query: ${sql}`);
      },
    };
  }

  it('will not read below what you cleared, whatever cursor is asked for', async () => {
    // The client's `sinceId` is a paging cursor; the cleared mark is a floor
    // under it. Letting a smaller sinceId win would hand back the conversation
    // that leaving deleted.
    const pool = chatPool({ marks: [{ clearedBeforeMessageId: 40 }] });

    await call(pool, {
      method: 'GET', url: '/buddies/5/messages?sinceId=3', query: { sinceId: '3' },
    });

    expect(pool.seen.selectParams).toEqual(['5', 40]);
  });

  it('pages forward normally when nothing was cleared', async () => {
    const pool = chatPool();

    await call(pool, {
      method: 'GET', url: '/buddies/5/messages?sinceId=12', query: { sinceId: '12' },
    });

    expect(pool.seen.selectParams).toEqual(['5', 12]);
  });

  it('signs the message with the guard, never with the body', async () => {
    // Otherwise either person in a conversation could post as the other.
    const pool = chatPool();

    await call(pool, {
      method: 'POST',
      url: '/buddies/5/messages',
      body: { body: 'a las 18?', senderProfileId: '9' },
    });

    expect(pool.seen.insert[1]).toBe('1');
  });

  it('refuses an empty message rather than storing a blank row', async () => {
    const pool = chatPool();
    const result = await call(pool, {
      method: 'POST', url: '/buddies/5/messages', body: { body: '   ' },
    });
    expect(result.status).toBe(400);
  });

  it('refuses a message past the length cap', async () => {
    const pool = chatPool();
    const result = await call(pool, {
      method: 'POST', url: '/buddies/5/messages', body: { body: 'x'.repeat(2001) },
    });
    expect(result.status).toBe(413);
  });

  it('refuses an oversized payload, which is the wider door', async () => {
    // `payload` exists to carry a shared routine. Uncapped it is a primitive
    // for writing arbitrary JSON into someone else's account.
    const pool = chatPool();
    const result = await call(pool, {
      method: 'POST',
      url: '/buddies/5/messages',
      body: { kind: 'routine', payload: { blob: 'x'.repeat(40_000) } },
    });
    expect(result.status).toBe(413);
  });

  it('refuses a kind it does not know', async () => {
    const pool = chatPool();
    const result = await call(pool, {
      method: 'POST', url: '/buddies/5/messages', body: { kind: 'invoice', body: 'hi' },
    });
    expect(result.status).toBe(400);
  });
});

describe('GET /stream', () => {
  /** Captures what the stream writes, and every query it issues. */
  function streamPool(seen) {
    return {
      query: async (sql, params) => {
        seen.push({ sql, params });
        if (sql.includes('FROM user_profiles WHERE user_id')) return { rows: [{ id: 1 }, { id: 2 }] };
        if (sql.includes('FROM buddy_links l')) {
          return { rows: [{
            id: 1, profileIdA: '1', profileIdB: '9', createdAt: new Date(),
            blockedByProfileId: null, removedByA: null, removedByB: null,
            buddyName: 'Ana', unreadCount: 0,
          }] };
        }
        return { rows: [] };
      },
    };
  }

  /** Opens the stream, lets it tick once, then hangs up. */
  function openStream(pool) {
    const router = socialRoutes(pool);
    const written = [];
    const closeHandlers = [];

    const req = {
      method: 'GET',
      url: '/stream?profileId=1',
      query: { profileId: '1' },
      body: {},
      user: { id: 7 },
      headers: {},
      on: (event, handler) => { if (event === 'close') closeHandlers.push(handler); },
    };
    const res = {
      statusCode: 200,
      set: () => res,
      flushHeaders: () => {},
      status(code) { res.statusCode = code; return res; },
      json() { return res; },
      write(chunk) { written.push(chunk); return true; },
      end() { return res; },
    };

    router(req, res, () => {});
    return { written, hangUp: () => closeHandlers.forEach(h => h()) };
  }

  it('joins the cleared cursor when reading messages', async () => {
    // Found against a real database, not here: a fresh stream starts its paging
    // cursor at zero, so without this join it replayed the entire conversation
    // the caller had deleted by leaving. A paging cursor is not a permission.
    vi.useFakeTimers();
    const seen = [];
    const { hangUp } = openStream(streamPool(seen));

    // Let the opening snapshot settle, then run exactly one poll tick.
    await vi.advanceTimersByTimeAsync(2500);
    hangUp();
    vi.useRealTimers();

    const messageRead = seen.find(q => q.sql.includes('FROM buddy_messages m'));
    expect(messageRead).toBeDefined();
    expect(messageRead.sql).toContain('clearedBeforeMessageId');
    // And it is the caller's own cursor being applied, not somebody else's.
    expect(messageRead.params).toContain('1');
  });

  it('opens with a hello carrying the snapshot and a cursor', async () => {
    vi.useFakeTimers();
    const { written, hangUp } = openStream(streamPool([]));
    await vi.advanceTimersByTimeAsync(10);
    hangUp();
    vi.useRealTimers();

    const body = written.join('');
    expect(body).toContain('event: hello');
    // So a reconnecting client resumes rather than replays.
    expect(body).toMatch(/id: m\d+\.p\d+/);
  });

  it('stops polling once the client hangs up', async () => {
    // Without this the invocation keeps querying, and billing, after nobody is
    // listening — on serverless that is the whole remaining function window.
    vi.useFakeTimers();
    const seen = [];
    const { hangUp } = openStream(streamPool(seen));
    await vi.advanceTimersByTimeAsync(50);
    hangUp();

    const afterHangUp = seen.length;
    await vi.advanceTimersByTimeAsync(10_000);
    vi.useRealTimers();

    expect(seen.length).toBe(afterHangUp);
  });
});

describe('POST /buddies/:linkId/block', () => {
  const link = over => ['SELECT * FROM buddy_links WHERE id', [{
    id: 5, profileIdA: '1', profileIdB: '9', createdAt: new Date(),
    blockedByProfileId: null, ...over,
  }]];

  it('lets the blocked side unblock nothing', async () => {
    // Routed outside guardBuddyLink on purpose — that guard refuses an already
    // blocked link, so unblocking through it would make every block permanent.
    // Which means this route has to decide for itself who may lift one.
    const pool = fakePool([OWNS_1_AND_2, link({ blockedByProfileId: '9' })]);
    const result = await call(pool, {
      method: 'POST', url: '/buddies/5/block', body: { profileId: '1', blocked: false },
    });
    expect(result.status).toBe(403);
  });

  it('lets the side that blocked lift it', async () => {
    const pool = fakePool([
      OWNS_1_AND_2,
      link({ blockedByProfileId: '1' }),
      ['UPDATE buddy_links', [{
        id: 5, profileIdA: '1', profileIdB: '9', createdAt: new Date(),
        blockedByProfileId: null,
      }]],
    ]);
    const result = await call(pool, {
      method: 'POST', url: '/buddies/5/block', body: { profileId: '1', blocked: false },
    });
    expect(result.status).toBe(200);
    expect(result.body.blockedByMe).toBe(false);
  });

  it("refuses to block on a friendship you are not part of", async () => {
    const pool = fakePool([OWNS_1_AND_2, link({ profileIdA: '8', profileIdB: '9' })]);
    const result = await call(pool, {
      method: 'POST', url: '/buddies/5/block', body: { profileId: '1', blocked: true },
    });
    expect(result.status).toBe(403);
  });
});

/**
 * Sharing a routine.
 *
 * The one payload one account sends another that the other account then writes
 * into its own storage. So what is stored is rebuilt field by field, and every
 * case below is a way the raw payload could have become something other than a
 * routine on the far side.
 */
describe('POST /buddies/:linkId/messages with a routine', () => {
  const LIVE_LINK = {
    id: 5, profileIdA: '1', profileIdB: '9', blockedByProfileId: null,
    removedByA: null, removedByB: null,
  };

  const ROUTINE = {
    title: 'Push A',
    description: 'Chest and shoulders',
    targetMuscles: ['chest'],
    exercises: [{
      exerciseId: '0025', exerciseName: 'Barbell Bench Press', targetSets: 4, targetReps: 8,
    }],
  };

  /** Sends a routine and reports the payload that reached the INSERT. */
  async function share(payload) {
    let stored = null;
    const pool = fakePool([
      OWNS_1_AND_2,
      ['SELECT * FROM buddy_links WHERE id', [LIVE_LINK]],
      ['INSERT INTO buddy_messages', params => {
        stored = params[4] == null ? null : JSON.parse(params[4]);
        return [{ id: 3, linkId: 5, senderProfileId: '1', kind: 'routine', createdAt: new Date() }];
      }],
    ]);

    const result = await call(pool, {
      method: 'POST', url: '/buddies/5/messages', body: { kind: 'routine', payload },
    });
    return { result, stored };
  }

  it('stores a routine without the sender ids that came with it', async () => {
    // `id` would aim the receiver's save at a row that is not theirs, and
    // `profileId` would file the copy under the person who sent it.
    const { result, stored } = await share({
      ...ROUTINE, id: 'r99', profileId: '1', createdAt: new Date(),
    });

    expect(result.status).toBe(201);
    expect(stored).not.toHaveProperty('id');
    expect(stored).not.toHaveProperty('profileId');
    expect(stored).not.toHaveProperty('createdAt');
    expect(stored.title).toBe('Push A');
  });

  it('keeps the catalogue id, which belongs to nobody', async () => {
    // It names a shared catalogue entry, and it is how the receiver's app finds
    // the exercise at all.
    const { stored } = await share(ROUTINE);
    expect(stored.exercises[0].exerciseId).toBe('0025');
  });

  it('drops the fields an exercise did not ask for', async () => {
    // Including a weight, which is the one field this whole feature has spent
    // five stages keeping out of another account.
    const { stored } = await share({
      ...ROUTINE,
      exercises: [{ ...ROUTINE.exercises[0], weight: 90, reps: 8, secret: 'x', notes: 'pausa' }],
    });

    expect(Object.keys(stored.exercises[0]).sort()).toEqual([
      'exerciseId', 'exerciseName', 'notes', 'targetReps', 'targetSets',
    ]);
  });

  it('refuses a routine with no exercises in it', async () => {
    // An empty card in a conversation is worse than a refused send: there is
    // nothing to save and nothing to explain.
    expect((await share({ ...ROUTINE, exercises: [] })).result.status).toBe(400);
    expect((await share({ title: 'Nothing' })).result.status).toBe(400);
  });

  it('refuses a payload that is not an object at all', async () => {
    expect((await share('Push A')).result.status).toBe(400);
    expect((await share(null)).result.status).toBe(400);
  });

  it('drops an exercise with no name, which nothing could render', async () => {
    const { stored } = await share({
      ...ROUTINE,
      exercises: [{ exerciseId: '1' }, ...ROUTINE.exercises],
    });

    expect(stored.exercises).toHaveLength(1);
    expect(stored.exercises[0].exerciseName).toBe('Barbell Bench Press');
  });

  it('caps how many exercises one routine may carry', async () => {
    const many = Array.from({ length: 100 }, (_, i) => ({
      exerciseId: String(i), exerciseName: `Exercise ${i}`, targetSets: 3,
    }));
    const { stored } = await share({ ...ROUTINE, exercises: many });

    expect(stored.exercises).toHaveLength(40);
  });

  it('replaces a nonsense set count rather than storing it', async () => {
    const { stored } = await share({
      ...ROUTINE,
      exercises: [{ ...ROUTINE.exercises[0], targetSets: -4, targetReps: 'lots' }],
    });

    expect(stored.exercises[0].targetSets).toBe(3);
    expect(stored.exercises[0].targetReps).toBe(10);
  });

  it('leaves the payload of a plain text message alone', async () => {
    // Only routines are rebuilt. The session invitation the server writes
    // itself must keep travelling as it is.
    let stored = null;
    const pool = fakePool([
      OWNS_1_AND_2,
      ['SELECT * FROM buddy_links WHERE id', [LIVE_LINK]],
      ['INSERT INTO buddy_messages', params => {
        stored = params[4];
        return [{ id: 3, linkId: 5, senderProfileId: '1', kind: 'text', createdAt: new Date() }];
      }],
    ]);

    await call(pool, {
      method: 'POST', url: '/buddies/5/messages', body: { body: 'a las 18' },
    });

    expect(stored).toBe(null);
  });
});

/**
 * Shared sessions.
 *
 * A container, not a synchronised workout: the only thing decided here is who is
 * in the room. So what is worth pinning is that a room cannot be opened twice
 * for the same pair, cannot be entered by claiming to already be in it, and can
 * always be left.
 */
describe('shared sessions', () => {
  const LIVE_LINK = {
    id: 5, profileIdA: '1', profileIdB: '9', blockedByProfileId: null,
    removedByA: null, removedByB: null,
  };

  const SESSION = {
    id: 12, linkId: 5, createdByProfileId: '1', createdAt: new Date(), endedAt: null,
  };

  const NO_PARTICIPANTS = ['FROM shared_session_participants', []];

  it('opens a container and announces it in the conversation', async () => {
    // The invitation is an ordinary message, so it rides the machinery that
    // already delivers messages — the stream, the badge, the transcript.
    let announced = null;
    const pool = fakePool([
      OWNS_1_AND_2,
      ['SELECT * FROM buddy_links WHERE id', [LIVE_LINK]],
      ['SELECT * FROM shared_sessions WHERE "linkId"', []],
      ['INSERT INTO shared_sessions', [SESSION]],
      ['INSERT INTO shared_session_participants', []],
      ['INSERT INTO buddy_messages', (params, sql) => { announced = { params, sql }; return []; }],
      NO_PARTICIPANTS,
    ]);

    const result = await call(pool, { method: 'POST', url: '/buddies/5/shared' });

    expect(result.status).toBe(201);
    expect(result.body.id).toBe('12');
    expect(announced.sql).toContain('sessionInvite');
    // The payload points at the container, which is all a client needs to join.
    expect(JSON.parse(announced.params[2])).toEqual({ sharedSessionId: '12' });
  });

  it('does not announce twice when the opener presses again', async () => {
    // The container already exists, so this request opened nothing — posting a
    // second invitation would invite somebody who is already in the room.
    const pool = fakePool([
      OWNS_1_AND_2,
      ['SELECT * FROM buddy_links WHERE id', [LIVE_LINK]],
      ['SELECT * FROM shared_sessions WHERE "linkId"', [SESSION]],
      ['INSERT INTO shared_session_participants', []],
      NO_PARTICIPANTS,
    ]);

    await call(pool, { method: 'POST', url: '/buddies/5/shared' });

    const announced = pool.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO buddy_messages'));
    expect(announced).toBe(false);
  });

  it('joins the container that exists rather than opening a second', async () => {
    // Both partners pressing "train together" within the same second is the
    // case this feature exists for, and two containers would leave each of them
    // looking at an empty room.
    const pool = fakePool([
      OWNS_1_AND_2,
      ['SELECT * FROM buddy_links WHERE id', [LIVE_LINK]],
      ['SELECT * FROM shared_sessions WHERE "linkId"', [SESSION]],
      ['INSERT INTO shared_session_participants', []],
      NO_PARTICIPANTS,
    ]);

    const result = await call(pool, { method: 'POST', url: '/buddies/5/shared' });

    expect(result.status).toBe(201);
    const opened = pool.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO shared_sessions'));
    expect(opened).toBe(false);
  });

  it('announces only from the side that opened it', async () => {
    // Otherwise the second arrival posts an invitation into the conversation,
    // inviting the person already standing there.
    const pool = fakePool([
      OWNS_1_AND_2,
      ['SELECT * FROM buddy_links WHERE id', [{ ...LIVE_LINK, profileIdA: '9', profileIdB: '1' }]],
      ['SELECT * FROM shared_sessions WHERE "linkId"', [{ ...SESSION, createdByProfileId: '9' }]],
      ['INSERT INTO shared_session_participants', []],
      NO_PARTICIPANTS,
    ]);

    await call(pool, { method: 'POST', url: '/buddies/5/shared' });

    const announced = pool.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO buddy_messages'));
    expect(announced).toBe(false);
  });

  it('refuses to join a session that has ended', async () => {
    // The invitation stays in the thread forever, so without this every old one
    // would still be a working door.
    const pool = fakePool([
      ['FROM shared_sessions s', [{ sharedId: 12, sharedEndedAt: new Date(), ...LIVE_LINK }]],
      OWNS_1_AND_2,
    ]);

    expect((await call(pool, { method: 'POST', url: '/shared/12/join' })).status).toBe(409);
  });

  it('refuses a session on a friendship you are not part of', async () => {
    const pool = fakePool([
      ['FROM shared_sessions s', [{
        sharedId: 12, sharedEndedAt: null, ...LIVE_LINK, profileIdA: '8', profileIdB: '9',
      }]],
      OWNS_1_AND_2,
    ]);

    expect((await call(pool, { method: 'POST', url: '/shared/12/join' })).status).toBe(403);
  });

  it('answers 404 for a session that does not exist, not 403', async () => {
    // "Does session 87 exist" is already a fact about two other people, and
    // walking the id space collecting 403s would map out who trains with whom.
    const pool = fakePool([['FROM shared_sessions s', []]]);

    expect((await call(pool, { method: 'POST', url: '/shared/87/join' })).status).toBe(404);
  });

  it('lets you leave a session that has already ended', async () => {
    // Leaving is how a workout ends, and workouts end where a failure cannot be
    // reported or retried — the app closing, the phone dying.
    const pool = fakePool([
      ['FROM shared_sessions s', [{ sharedId: 12, sharedEndedAt: new Date(), ...LIVE_LINK }]],
      OWNS_1_AND_2,
      ['UPDATE shared_session_participants', []],
      ['UPDATE live_sessions', []],
      ['UPDATE shared_sessions SET "endedAt"', []],
    ]);

    expect((await call(pool, { method: 'POST', url: '/shared/12/leave' })).status).toBe(204);
  });

  it('cuts only the container tie, leaving you training alone', async () => {
    // Stepping out of a shared session is not finishing a workout. Clearing the
    // presence row here would end somebody's session because their partner went
    // home early.
    let cleared = null;
    const pool = fakePool([
      ['FROM shared_sessions s', [{ sharedId: 12, sharedEndedAt: null, ...LIVE_LINK }]],
      OWNS_1_AND_2,
      ['UPDATE shared_session_participants', []],
      ['UPDATE live_sessions', params => { cleared = params; return []; }],
      ['UPDATE shared_sessions SET "endedAt"', []],
    ]);

    await call(pool, { method: 'POST', url: '/shared/12/leave' });

    expect(cleared).toEqual(['1', '12']);
    const deleted = pool.query.mock.calls.some(([sql]) => sql.includes('DELETE FROM live_sessions'));
    expect(deleted).toBe(false);
  });
});

describe('PUT /presence', () => {
  it('drops a shared session the caller has not joined', async () => {
    // Membership is an act, not an assertion. Taking the client's word for it
    // would put somebody in a room they were never let into.
    let written = null;
    const pool = fakePool([
      OWNS_1_AND_2,
      ['SELECT "sharePresence" FROM user_profiles', [{ sharePresence: true }]],
      ['FROM shared_session_participants p', []],
      ['INSERT INTO live_sessions', params => { written = params; return []; }],
    ]);

    const result = await call(pool, {
      method: 'PUT',
      url: '/presence',
      body: { profileId: '1', snapshot: { sessionKey: 'k', sharedSessionId: '99' } },
    });

    expect(result.status).toBe(204);
    // The container is the last parameter, and it must have been dropped.
    expect(written[written.length - 1]).toBe(null);
  });

  it('keeps a shared session the caller is actually in', async () => {
    let written = null;
    const pool = fakePool([
      OWNS_1_AND_2,
      ['SELECT "sharePresence" FROM user_profiles', [{ sharePresence: true }]],
      ['FROM shared_session_participants p', [{ ok: 1 }]],
      ['INSERT INTO live_sessions', params => { written = params; return []; }],
    ]);

    await call(pool, {
      method: 'PUT',
      url: '/presence',
      body: { profileId: '1', snapshot: { sessionKey: 'k', sharedSessionId: '12' } },
    });

    expect(written[written.length - 1]).toBe('12');
  });
});
