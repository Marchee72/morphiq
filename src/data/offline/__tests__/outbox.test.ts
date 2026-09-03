import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  OUTBOX_LIMIT, OfflineUnavailableError, cancelDependents, clearOutbox, enqueue,
  fail, failedCount, hasPending, peekNext, pendingCount,
  resolveId, lookupId, settle,
} from '../outbox';
import { offlineDb } from '../offlineDb';
import { setSession, clearSession } from '../../auth/session';
import type { NewOp } from '../outbox';

/**
 * The queue that stands between a workout logged in a basement and the database.
 *
 * Two properties matter and both are easy to lose. Order, because sets
 * reference the workout they belong to and a re-insert must land after the
 * delete it replaces. And the coalescing rules, which exist so the queue never
 * asks the server for something incoherent — a DELETE for a row the server has
 * never heard of, or a workout's sets orphaned behind a parent that was
 * discarded.
 */

const P = '1';
const USER = { id: 1, email: 'marchee72@gmail.com', name: 'Marche', picture: null };

function op(over: Partial<NewOp> = {}): NewOp {
  return { kind: 'workoutLog', op: 'insert', profileId: P, ...over } as NewOp;
}

beforeEach(async () => {
  setSession({ token: 't', user: USER });
  await clearOutbox();
  await offlineDb().rows.clear();
  await offlineDb().meta.clear();
});

afterEach(() => {
  clearSession();
});

describe('ordering', () => {
  it('hands back what was queued first, however the writes settled', async () => {
    // `finishActiveSession` writes its sets through a `Promise.all`. The seq is
    // assigned inside the add, so concurrency cannot reorder the workout behind
    // the sets that point at it.
    await enqueue(op({ tempId: 'tmp_A', clientId: 'A' }));
    await Promise.all([
      enqueue(op({ kind: 'workoutSet', tempId: 'tmp_B', clientId: 'B' })),
      enqueue(op({ kind: 'workoutSet', tempId: 'tmp_C', clientId: 'C' })),
      enqueue(op({ kind: 'workoutSet', tempId: 'tmp_D', clientId: 'D' })),
    ]);

    expect((await peekNext())!.tempId).toBe('tmp_A');
    expect(await pendingCount()).toBe(4);
  });

  it('orders across profiles, not within each one', async () => {
    /**
     * One queue rather than one per profile, which is not the obvious choice.
     * Half the repository methods delete by id alone — `delete(id)` names no
     * profile anywhere in `IDatabase` — so a per-profile queue would have to
     * invent a partition for those, and a delete filed apart from the insert it
     * cancels is a delete that never cancels it.
     */
    await enqueue(op({ profileId: '1', tempId: 'tmp_A' }));
    await enqueue(op({ profileId: '2', tempId: 'tmp_B' }));

    expect((await peekNext())!.tempId).toBe('tmp_A');
    expect(await pendingCount()).toBe(2);
  });

  it('cancels a delete against an insert filed under a different profile', async () => {
    // The case the single queue exists for: `measurement.delete(id)` has no
    // profile to look one up by, so it uses a placeholder.
    await enqueue(op({ kind: 'measurement', profileId: '1', tempId: 'tmp_M' }));
    const result = await enqueue(op({ kind: 'measurement', profileId: '__account__', op: 'delete', targetId: 'tmp_M' }));

    expect(result).toBeNull();
    expect(await pendingCount()).toBe(0);
  });

  it('drains in order as each op settles', async () => {
    await enqueue(op({ tempId: 'tmp_A' }));
    await enqueue(op({ tempId: 'tmp_B' }));

    const first = await peekNext();
    await settle(first!.seq!);
    expect((await peekNext())!.tempId).toBe('tmp_B');
  });
});

describe('create-then-delete', () => {
  it('sends nothing when a row created offline is deleted offline', async () => {
    // The server has never heard of it, so the right number of requests is zero.
    await enqueue(op({ tempId: 'tmp_A', clientId: 'A' }));
    const result = await enqueue(op({ op: 'delete', targetId: 'tmp_A' }));

    expect(result).toBeNull();
    expect(await pendingCount()).toBe(0);
  });

  it('never queues a DELETE addressed by a temp id', async () => {
    /**
     * Not merely wasteful — unsafe. `guardRow` only checks ownership for ids
     * matching /^\d+$/ and waves everything else straight through to a handler
     * that then runs `WHERE id = 'tmp_…'` and 500s. So this op must not exist
     * even when there is no queued insert for it to cancel.
     */
    const result = await enqueue(op({ op: 'delete', targetId: 'tmp_orphan' }));

    expect(result).toBeNull();
    expect(await pendingCount()).toBe(0);
  });

  it('takes the sets down with the workout they belonged to', async () => {
    await enqueue(op({ tempId: 'tmp_A', clientId: 'A' }));
    await enqueue(op({ kind: 'workoutSet', tempId: 'tmp_S1', payload: { workoutLogId: 'tmp_A' }, refs: ['workoutLogId'] }));
    await enqueue(op({ kind: 'workoutSet', tempId: 'tmp_S2', payload: { workoutLogId: 'tmp_A' }, refs: ['workoutLogId'] }));

    await enqueue(op({ op: 'delete', targetId: 'tmp_A' }));

    // Left behind, they would point at a temp id nothing will ever resolve —
    // and being FIFO, they would block every write queued after them.
    expect(await pendingCount()).toBe(0);
  });

  it('still queues a delete for a row the server does know about', async () => {
    const seq = await enqueue(op({ op: 'delete', targetId: '431' }));
    expect(seq).not.toBeNull();
    expect((await peekNext())!.targetId).toBe('431');
  });
});

describe('wellness', () => {
  it('replaces the pending day rather than queueing it twice', async () => {
    const first = await enqueue(op({ kind: 'wellness', payload: { day: '2026-09-02', energy: 3 } }));
    const second = await enqueue(op({ kind: 'wellness', payload: { day: '2026-09-02', energy: 5 } }));

    // Same slot, so the day keeps its place in the order.
    expect(second).toBe(first);
    expect(await pendingCount()).toBe(1);
    expect((await peekNext())!.payload).toEqual({ day: '2026-09-02', energy: 5 });
  });

  it('replaces rather than merges, because the payload is already the merged truth', async () => {
    // `saveWellnessDay` reads the day before writing it, and offline that read
    // hits the cache the first op already updated. Merging would fold the same
    // values in a second time.
    await enqueue(op({ kind: 'wellness', payload: { day: '2026-09-02', energy: 3, soreness: 2 } }));
    await enqueue(op({ kind: 'wellness', payload: { day: '2026-09-02', energy: 5 } }));

    expect((await peekNext())!.payload).toEqual({ day: '2026-09-02', energy: 5 });
  });

  it('keeps different days apart', async () => {
    await enqueue(op({ kind: 'wellness', payload: { day: '2026-09-01' } }));
    await enqueue(op({ kind: 'wellness', payload: { day: '2026-09-02' } }));
    expect(await pendingCount()).toBe(2);
  });
});

describe('favourites', () => {
  it('cancels a star that was unstarred before either was sent', async () => {
    await enqueue(op({ kind: 'favorite', op: 'insert', payload: { exerciseId: '0025' } }));
    const result = await enqueue(op({ kind: 'favorite', op: 'delete', targetId: '0025' }));

    expect(result).toBeNull();
    expect(await pendingCount()).toBe(0);
  });

  it('leaves a different exercise alone', async () => {
    await enqueue(op({ kind: 'favorite', op: 'insert', payload: { exerciseId: '0025' } }));
    await enqueue(op({ kind: 'favorite', op: 'delete', targetId: '0099' }));
    expect(await pendingCount()).toBe(2);
  });
});

describe('failure', () => {
  it('keeps a failed op rather than dropping it silently', async () => {
    // Losing a workout without saying so is the one outcome this layer exists
    // to prevent; the count is what lets the banner admit it.
    const seq = await enqueue(op({ tempId: 'tmp_A' }));
    await fail(seq!, 'HTTP 400');

    expect(await pendingCount()).toBe(0);
    expect(await failedCount()).toBe(1);
  });

  it('does not leave a failed insert\'s dependents blocking the queue', async () => {
    const seq = await enqueue(op({ tempId: 'tmp_A' }));
    await enqueue(op({ kind: 'workoutSet', payload: { workoutLogId: 'tmp_A' }, refs: ['workoutLogId'] }));
    await enqueue(op({ kind: 'measurement', tempId: 'tmp_M' }));

    await fail(seq!, 'HTTP 400');

    // The set can never succeed. The measurement is unrelated and must survive.
    expect(await pendingCount()).toBe(1);
    expect((await peekNext())!.kind).toBe('measurement');
  });
});

describe('cancelDependents', () => {
  it('follows a chain rather than stranding its tail', async () => {
    await enqueue(op({ tempId: 'tmp_A' }));
    await enqueue(op({ kind: 'workoutSet', tempId: 'tmp_B', payload: { workoutLogId: 'tmp_A' }, refs: ['workoutLogId'] }));
    await enqueue(op({ kind: 'workoutSet', op: 'delete', targetId: 'tmp_B' }));

    await cancelDependents('tmp_A');
    expect(await pendingCount()).toBe(1); // only the parent insert itself remains
  });
});

describe('id resolution', () => {
  it('remembers what the server called a row', async () => {
    await resolveId('tmp_A', '42');
    expect(await lookupId('tmp_A')).toBe('42');
  });

  it('has no answer for a temp id that never landed', async () => {
    expect(await lookupId('tmp_never')).toBeUndefined();
  });
});

describe('the cap', () => {
  it('refuses rather than filling the disk', async () => {
    // `importWorkouts` runs on every resume. It should add nothing during a long
    // offline stretch, and a cap is cheaper than trusting that it does.
    const db = offlineDb();
    await db.ops.bulkAdd(
      Array.from({ length: OUTBOX_LIMIT }, () => ({
        kind: 'workoutLog' as const, op: 'insert' as const, profileId: P,
        status: 'pending' as const, createdAt: new Date(),
      })),
    );

    await expect(enqueue(op())).rejects.toBeInstanceOf(OfflineUnavailableError);
  });
});

describe('hasPending', () => {
  it('is what lets an online write skip the queue safely', async () => {
    // A direct send past a queued op would let a later write land first, so the
    // check has to see the whole queue — not just this profile's share of it.
    expect(await hasPending()).toBe(false);
    await enqueue(op({ profileId: '2', tempId: 'tmp_A' }));
    expect(await hasPending()).toBe(true);
  });
});
