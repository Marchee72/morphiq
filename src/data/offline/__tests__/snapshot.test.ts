import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  cacheRow, cacheRows, cachedProfileIds, evictRow, evictWhere, readPartition,
  rekeyRow, rewriteRefs,
} from '../snapshot';
import { canEnterOffline, clearMarker, readMarker } from '../snapshotMarker';
import { offlineDb } from '../offlineDb';
import { PROFILE_PARTITION } from '../types';
import { clearSession, setSession } from '../../auth/session';

/**
 * The last thing the app knew, and who it belongs to.
 *
 * The account stamp is the most important thing here and the least obvious.
 * `sw.js` and the API's `no-store` both refuse to cache a response on the
 * grounds that a cache is per-browser while an account is not; this module
 * reverses that decision, so it carries the check that pays for it. A shared
 * phone must never show the previous person's training history.
 */

const P = '1';
const ALICE = { id: 1, email: 'alice@example.test', name: 'Alice', picture: null };
const BOB = { id: 2, email: 'bob@example.test', name: 'Bob', picture: null };

const log = (id: string, over: Record<string, unknown> = {}) => ({
  id, profileId: P, type: 'strength', timestamp: new Date('2026-09-02T10:00:00Z'), ...over,
});

beforeEach(async () => {
  setSession({ token: 't', user: ALICE });
  clearMarker();
  const db = offlineDb();
  await db.rows.clear();
  await db.meta.clear();
  await db.ops.clear();
});

afterEach(() => {
  clearSession();
  clearMarker();
});

describe('partitions', () => {
  it('gives back what was cached', async () => {
    await cacheRows('workoutLog', P, [log('1'), log('2')], 'replace');
    expect(await readPartition('workoutLog', P)).toHaveLength(2);
  });

  it('keeps kinds and profiles apart', async () => {
    await cacheRows('workoutLog', P, [log('1')], 'replace');
    await cacheRows('measurement', P, [{ id: '1', profileId: P }], 'replace');
    await cacheRows('workoutLog', '2', [{ id: '9', profileId: '2' }], 'replace');

    expect(await readPartition('workoutLog', P)).toHaveLength(1);
    expect(await readPartition('measurement', P)).toHaveLength(1);
    expect(await readPartition('workoutLog', '2')).toHaveLength(1);
  });

  it('round-trips a Date without a revive step', async () => {
    // IndexedDB structured-clones a Date natively. That is why this cache does
    // not need the custom revive `sessionPersistence.ts` carries — and so has
    // no revive to forget when a field is added.
    await cacheRows('workoutLog', P, [log('1')], 'replace');
    const [row] = await readPartition<{ timestamp: Date }>('workoutLog', P);
    expect(row.timestamp).toBeInstanceOf(Date);
    expect(row.timestamp.toISOString()).toBe('2026-09-02T10:00:00.000Z');
  });

  it('overwrites a row rather than accumulating copies of it', async () => {
    await cacheRows('workoutLog', P, [log('1', { type: 'strength' })], 'merge');
    await cacheRows('workoutLog', P, [log('1', { type: 'cardio' })], 'merge');

    const rows = await readPartition<{ type: string }>('workoutLog', P);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('cardio');
  });

  it('skips a row with no id, which could never be addressed again', async () => {
    await cacheRows('workoutLog', P, [{ profileId: P, type: 'strength' }], 'merge');
    expect(await readPartition('workoutLog', P)).toHaveLength(0);
  });
});

describe('replace versus merge', () => {
  it('drops rows a complete read no longer returns', async () => {
    // A read that asked for everything is the whole truth, so what is missing
    // from it was deleted somewhere else.
    await cacheRows('workoutLog', P, [log('1'), log('2')], 'replace');
    await cacheRows('workoutLog', P, [log('1')], 'replace');

    expect(await readPartition('workoutLog', P)).toHaveLength(1);
  });

  it('leaves other days alone when a filtered read comes back', async () => {
    /**
     * The trap this exists for. `getAll(profileId, date)` asks for one day, and
     * `getRange` for a window. Letting either replace the partition would throw
     * away the history the user opened the app to look at — a single tap on
     * "today" would erase everything else.
     */
    await cacheRows('workoutLog', P, [log('1'), log('2'), log('3')], 'replace');
    await cacheRows('workoutLog', P, [log('2', { type: 'cardio' })], 'merge');

    expect(await readPartition('workoutLog', P)).toHaveLength(3);
  });

  it('does not let one profile\'s complete read clear another\'s', async () => {
    await cacheRows('workoutLog', '2', [{ id: '9', profileId: '2' }], 'replace');
    await cacheRows('workoutLog', P, [log('1')], 'replace');
    expect(await readPartition('workoutLog', '2')).toHaveLength(1);
  });
});

describe('the account stamp', () => {
  it('refuses to serve a cache filled by someone else', async () => {
    await cacheRows('workoutLog', P, [log('1'), log('2')], 'replace');

    // Same browser, same IndexedDB, different person.
    setSession({ token: 't2', user: BOB });
    expect(await readPartition('workoutLog', P)).toEqual([]);
  });

  it('refuses to add to someone else\'s cache', async () => {
    await cacheRows('workoutLog', P, [log('1')], 'replace');

    setSession({ token: 't2', user: BOB });
    await cacheRows('workoutLog', P, [log('99')], 'merge');

    setSession({ token: 't', user: ALICE });
    const rows = await readPartition<{ id: string }>('workoutLog', P);
    expect(rows.map(r => r.id)).toEqual(['1']);
  });

  it('serves nothing when nobody is signed in', async () => {
    await cacheRows('workoutLog', P, [log('1')], 'replace');
    clearSession();
    expect(await readPartition('workoutLog', P)).toEqual([]);
  });
});

describe('eviction', () => {
  it('drops one row', async () => {
    await cacheRows('workoutLog', P, [log('1'), log('2')], 'replace');
    await evictRow('workoutLog', '1');
    expect(await readPartition('workoutLog', P)).toHaveLength(1);
  });

  it('cascades the sets of a deleted workout, as the server does in one transaction', async () => {
    await cacheRows('workoutSet', P, [
      { id: 's1', profileId: P, workoutLogId: '10' },
      { id: 's2', profileId: P, workoutLogId: '10' },
      { id: 's3', profileId: P, workoutLogId: '11' },
    ], 'replace');

    await evictWhere('workoutSet', P, r => r.workoutLogId === '10');

    const rows = await readPartition<{ id: string }>('workoutSet', P);
    expect(rows.map(r => r.id)).toEqual(['s3']);
  });
});

describe('resolving a temp id', () => {
  it('re-files the row under the id the server gave it', async () => {
    // Left under the temp key, the next complete read would delete it as stale
    // and the workout would blink out and back in.
    await cacheRow('workoutLog', P, log('tmp_A'));
    await rekeyRow('workoutLog', 'tmp_A', '42');

    const rows = await readPartition<{ id: string }>('workoutLog', P);
    expect(rows.map(r => r.id)).toEqual(['42']);
  });

  it('makes the sets follow the workout they point at', async () => {
    await cacheRows('workoutSet', P, [
      { id: 'tmp_S1', profileId: P, workoutLogId: 'tmp_A' },
      { id: 'tmp_S2', profileId: P, workoutLogId: 'tmp_A' },
      { id: 's9', profileId: P, workoutLogId: '7' },
    ], 'merge');

    await rewriteRefs('workoutSet', P, 'workoutLogId', 'tmp_A', '42');

    const rows = await readPartition<{ workoutLogId: string }>('workoutSet', P);
    expect(rows.map(r => r.workoutLogId).sort()).toEqual(['42', '42', '7']);
  });
});

describe('the boot marker', () => {
  it('is written whenever profiles are cached, so the gate can read it synchronously', async () => {
    await cacheRows('profile', PROFILE_PARTITION, [{ id: '1' }, { id: '2' }], 'replace');

    expect(readMarker()).toMatchObject({ userId: ALICE.id, profileIds: ['1', '2'] });
    expect(await cachedProfileIds()).toEqual(['1', '2']);
  });

  it('opens the app offline once there is a stamped snapshot', async () => {
    await cacheRows('profile', PROFILE_PARTITION, [{ id: '1' }], 'replace');
    expect(canEnterOffline()).toBe(true);
  });

  it('refuses when the snapshot belongs to a different account', async () => {
    /**
     * The single most important assertion in the feature. Sign out on a shared
     * phone, sign in as someone else, kill the network: without this check the
     * app opens on the previous person's training history.
     */
    await cacheRows('profile', PROFILE_PARTITION, [{ id: '1' }], 'replace');
    setSession({ token: 't2', user: BOB });

    expect(canEnterOffline()).toBe(false);
  });

  it('refuses with no session at all', async () => {
    await cacheRows('profile', PROFILE_PARTITION, [{ id: '1' }], 'replace');
    clearSession();
    expect(canEnterOffline()).toBe(false);
  });

  it('refuses when nothing has been cached yet', () => {
    // A fresh install that has never reached the server has nothing to show,
    // and an empty app is worse than an honest "cannot reach the server".
    expect(canEnterOffline()).toBe(false);
  });
});
