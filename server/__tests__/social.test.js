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
          return { rows: typeof rows === 'function' ? rows(params) : rows };
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
    const seen = { update: null, cleared: null, deleted: false };
    const pool = {
      seen,
      query: async (sql, params) => {
        if (sql.includes('FROM user_profiles WHERE user_id')) return { rows: [{ id: 1 }, { id: 2 }] };
        if (sql.includes('SELECT * FROM buddy_links WHERE id')) return { rows: [link] };
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
