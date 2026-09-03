/**
 * The writes that have not reached the server yet.
 *
 * A strict FIFO queue per profile, and the ordering is the contract rather than
 * an implementation detail: the sets of a workout reference the workout, and
 * `linkPendingRoutineToWorkout` deletes rows and then re-inserts them. Either
 * one, replayed out of order, produces data that is wrong rather than merely
 * late.
 *
 * Knows nothing about HTTP. It holds what to send and in what order; the
 * flusher decides how.
 *
 * Coalescing happens here, at enqueue time, not at drain time. That is
 * deliberate: the cache is what the UI reads, and the cache is updated by the
 * same call that enqueues. Deciding at drain time that two ops cancel out would
 * mean the queue and the screen disagreed for however long the drain took.
 */

import { offlineDb } from './offlineDb';
import { isTempId } from './ids';
import type { OutboxOp, RowKind } from './types';

/**
 * How many unsent writes to hold before refusing more.
 *
 * `importWorkouts` and `importMeasurements` run on every app resume, and they
 * dedupe against what is already loaded — so during a long offline stretch they
 * should add nothing. "Should" is doing a lot of work in that sentence, and an
 * unbounded queue on a phone fills the disk. The cap is cheaper than trusting
 * the dedup, and 5000 is far past any honest use: a heavy session is 40 ops.
 */
export const OUTBOX_LIMIT = 5000;

/** Raised when a write cannot be accepted offline at all. */
export class OfflineUnavailableError extends Error {
  constructor(message = 'This needs a connection') {
    super(message);
    this.name = 'OfflineUnavailableError';
  }
}

export type NewOp = Omit<OutboxOp, 'seq' | 'status' | 'createdAt'>;

/**
 * Adds a write to the queue, unless something already queued cancels it out.
 *
 * Returns the seq it was filed under, or null when the op annihilated an
 * earlier one and neither needs sending.
 */
export async function enqueue(op: NewOp): Promise<number | null> {
  const db = offlineDb();

  const pending = await db.ops.where('status').equals('pending').sortBy('seq');
  if (pending.length >= OUTBOX_LIMIT) throw new OfflineUnavailableError('Too many unsent changes');

  const coalesced = await coalesce(op, pending);
  if (coalesced === 'annihilated') return null;
  if (typeof coalesced === 'number') return coalesced;

  return await db.ops.add({ ...op, status: 'pending', createdAt: new Date() }) as number;
}

/**
 * Applies the rules for an op that meets one already waiting.
 *
 * Returns `'annihilated'` when nothing should be sent, the seq of an op that
 * absorbed this one, or `'append'`.
 */
async function coalesce(op: NewOp, pending: OutboxOp[]): Promise<number | 'annihilated' | 'append'> {
  const db = offlineDb();

  /**
   * Deleting something that was only ever created offline.
   *
   * The server has never heard of the row, so the correct number of requests is
   * zero — and it is also the only safe number. A DELETE addressed by a temp id
   * would skip `guardRow`'s ownership check (it only tests numeric ids) and
   * then 500 in the handler on `WHERE id = 'tmp_…'`.
   */
  if (op.op === 'delete' && isTempId(op.targetId)) {
    const insert = pending.find(p => p.tempId === op.targetId);
    if (insert) {
      await db.ops.delete(insert.seq!);
      await cancelDependents(op.targetId!);
      return 'annihilated';
    }
    // No queued insert to cancel and no real id to send: the row is unreachable
    // either way, so dropping the op is the only outcome that does not wedge
    // the queue behind something that can never succeed.
    return 'annihilated';
  }

  /**
   * The same wellness day answered twice.
   *
   * Replace the pending payload rather than merging onto it. `saveWellnessDay`
   * reads the day first, which offline hits the cache — and the cache already
   * holds what the first op wrote. So the second payload *is* the merged truth;
   * merging again would fold the same values in twice.
   *
   * This is also what keeps `importWellnessSignals` from queueing one op per
   * app resume across a week with no signal.
   */
  if (op.kind === 'wellness' && op.op === 'insert') {
    const day = op.payload?.day;
    const existing = pending.find(p =>
      p.kind === 'wellness' && p.profileId === op.profileId && p.payload?.day === day);
    if (existing) {
      await db.ops.update(existing.seq!, { payload: op.payload });
      return existing.seq!;
    }
  }

  /**
   * A favourite starred and unstarred before either reached the server.
   *
   * Both endpoints are already idempotent, so this is a size optimisation
   * rather than a correctness fix — but four taps on a star should not be four
   * requests waiting in a queue.
   */
  if (op.kind === 'favorite') {
    const exerciseId = op.payload?.exerciseId ?? op.targetId;
    const opposite = pending.find(p =>
      p.kind === 'favorite'
      && p.profileId === op.profileId
      && p.op !== op.op
      && (p.payload?.exerciseId ?? p.targetId) === exerciseId);
    if (opposite) {
      await db.ops.delete(opposite.seq!);
      return 'annihilated';
    }
  }

  return 'append';
}

/**
 * Drops every queued op that depends on a row that will never exist.
 *
 * Called when an insert is cancelled or fails permanently. Without it, the sets
 * of a discarded workout sit in the queue forever pointing at a temp id nothing
 * will ever resolve — and because the queue is FIFO, they block everything
 * behind them.
 */
export async function cancelDependents(tempId: string): Promise<void> {
  const db = offlineDb();
  const pending = await db.ops.where('status').equals('pending').toArray();

  const doomed = pending.filter(p =>
    p.targetId === tempId
    || (p.refs ?? []).some(field => p.payload?.[field] === tempId));

  if (doomed.length === 0) return;
  await db.ops.bulkDelete(doomed.map(p => p.seq!));

  // A cancelled insert may itself have had dependents. One level is enough for
  // the shapes this app writes, but recursing costs nothing and means a deeper
  // chain does not quietly strand its tail.
  for (const op of doomed) {
    if (op.tempId) await cancelDependents(op.tempId);
  }
}

/** The next op to send, or undefined when the queue is drained. */
export async function peekNext(): Promise<OutboxOp | undefined> {
  const pending = await offlineDb().ops.where('status').equals('pending').sortBy('seq');
  return pending[0];
}

/** The op landed. */
export async function settle(seq: number): Promise<void> {
  await offlineDb().ops.delete(seq);
}

/**
 * The op will never land.
 *
 * Kept rather than deleted, so the count can be surfaced and the user told that
 * something of theirs did not make it. Silently dropping a workout is the one
 * outcome this whole layer exists to prevent.
 */
export async function fail(seq: number, reason: string): Promise<void> {
  const db = offlineDb();
  const op = await db.ops.get(seq);
  if (!op) return;

  await db.ops.update(seq, { status: 'failed', error: reason });
  // Its dependents cannot succeed either, and leaving them pending would block
  // every later write behind a parent that is never coming.
  if (op.tempId) await cancelDependents(op.tempId);
}

export async function pendingCount(): Promise<number> {
  return await offlineDb().ops.filter(op => op.status === 'pending').count();
}

export async function failedCount(): Promise<number> {
  return await offlineDb().ops.filter(op => op.status === 'failed').count();
}

/**
 * Whether anything is waiting — the check that guards the write fast path.
 *
 * Global, like the ordering. A write that went direct while anything at all was
 * queued could land before something enqueued before it.
 */
export async function hasPending(): Promise<boolean> {
  return (await offlineDb().ops.where('status').equals('pending').count()) > 0;
}

/** Records what the server called a row, so later ops can point at it. */
export async function resolveId(tempId: string, serverId: string): Promise<void> {
  await offlineDb().ids.put({ tempId, serverId });
}

export async function lookupId(tempId: string): Promise<string | undefined> {
  return (await offlineDb().ids.get(tempId))?.serverId;
}

/** Clears the failed ops the user has been told about. */
export async function discardFailed(): Promise<void> {
  const db = offlineDb();
  const failed = await db.ops.filter(op => op.status === 'failed').toArray();
  if (failed.length > 0) await db.ops.bulkDelete(failed.map(op => op.seq!));
}

/** Test seam. */
export async function clearOutbox(): Promise<void> {
  const db = offlineDb();
  await db.ops.clear();
  await db.ids.clear();
}

export type { OutboxOp, RowKind };
