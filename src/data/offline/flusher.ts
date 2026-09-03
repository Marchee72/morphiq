/**
 * Drains the outbox when the network comes back.
 *
 * Strictly one op at a time, strictly in order, strictly one drain at a time.
 * All three are load-bearing rather than conservative: the sets of a workout
 * carry the workout's id, which does not exist until the workout lands, so the
 * order is the difference between a session and a pile of orphans. And two
 * concurrent drains would send the same op twice — harmless on the server now
 * that `clientId` exists, but it would race the id table and double the traffic
 * from a device that just told us it has bad signal.
 */

import { BACKOFF_START_MS, jitter, nextBackoff } from '../net/backoff';
import { classifyFailure } from './errors';
import { isOnline, reportReachable, reportUnreachable, subscribe } from './connectivity';
import { isTempId } from './ids';
import { fail, failedCount, lookupId, peekNext, pendingCount, resolveId, settle } from './outbox';
import { rekeyRow, rewriteRefs } from './snapshot';
import { setSyncState } from './syncState';
import type { OutboxOp, RowKind } from './types';

/** How an op is actually put on the wire. Supplied by the repository layer. */
export type Sender = (op: OutboxOp) => Promise<string | void>;

/** Told when a temp id becomes a real one, so the UI can follow. */
export type IdResolvedListener = (kind: RowKind, tempId: string, serverId: string) => void;

/** Told when the queue empties, so the app can reconcile with the server. */
export type DrainedListener = () => void;

let send: Sender | null = null;
const idListeners = new Set<IdResolvedListener>();
const drainedListeners = new Set<DrainedListener>();

let flushing = false;
let backoff = BACKOFF_START_MS;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let stopped = false;

export function configureFlusher(sender: Sender): void {
  send = sender;
}

export function onIdResolved(listener: IdResolvedListener): () => void {
  idListeners.add(listener);
  return () => { idListeners.delete(listener); };
}

export function onDrained(listener: DrainedListener): () => void {
  drainedListeners.add(listener);
  return () => { drainedListeners.delete(listener); };
}

/** Publishes the counts the banner renders. */
async function publish(): Promise<void> {
  setSyncState({
    online: isOnline(),
    pending: await pendingCount(),
    failed: await failedCount(),
    flushing,
  });
}

/**
 * Replaces any temp id in an op with the id the server gave it.
 *
 * Returns null when a reference cannot be resolved — which, given the queue is
 * FIFO, can only mean the op it depends on failed permanently rather than
 * simply not having run yet.
 */
async function resolveRefs(op: OutboxOp): Promise<OutboxOp | null> {
  if (isTempId(op.targetId)) {
    const real = await lookupId(op.targetId!);
    if (!real) return null;
    op = { ...op, targetId: real };
  }

  const refs = op.refs ?? [];
  if (refs.length === 0 || !op.payload) return op;

  const payload = { ...op.payload };
  for (const field of refs) {
    const value = payload[field];
    if (typeof value === 'string' && isTempId(value)) {
      const real = await lookupId(value);
      if (!real) return null;
      payload[field] = real;
    }
  }
  return { ...op, payload };
}

/**
 * Sends one op.
 *
 * Returns whether the drain should keep going. A permanent failure fails that
 * op and its dependents and returns true — one poisoned write must not hold a
 * whole session hostage behind it. A retryable one stops the drain, because the
 * network is gone and the next op would only fail the same way.
 */
async function sendOne(op: OutboxOp): Promise<boolean> {
  const resolved = await resolveRefs(op);
  if (resolved === null) {
    await fail(op.seq!, 'A change this one depended on could not be saved');
    return true;
  }

  try {
    const serverId = await send!(resolved);
    reportReachable();
    await settle(op.seq!);

    if (op.tempId && typeof serverId === 'string' && serverId.length > 0) {
      await resolveId(op.tempId, serverId);
      // The optimistic row was filed under the temp id. Left there, the next
      // complete read would delete it as stale and the workout would blink out
      // and back in; the rows pointing at it would dangle in the meantime.
      await rekeyRow(op.kind, op.tempId, serverId);
      if (op.kind === 'workoutLog') {
        await rewriteRefs('workoutSet', op.profileId, 'workoutLogId', op.tempId, serverId);
      }
      for (const listener of [...idListeners]) {
        try { listener(op.kind, op.tempId, serverId); } catch { /* the reconcile catches it */ }
      }
    }
    return true;
  } catch (err) {
    const failure = classifyFailure(err);

    if (failure === 'auth') {
      /**
       * Stop, and keep the queue.
       *
       * These are still the user's writes. Discarding them because a token
       * expired would lose a workout for a reason that has nothing to do with
       * the workout — and signing back in is exactly the thing about to happen.
       */
      stopped = true;
      return false;
    }

    if (failure === 'permanent') {
      await fail(op.seq!, (err as Error).message);
      return true;
    }

    reportUnreachable();
    return false;
  }
}

/**
 * Sends everything waiting, for every profile with anything waiting.
 *
 * Single-flight through the `flushing` flag rather than a lock — the same
 * shape, and the same reasoning, as `isFinishingSession` in `store.ts`.
 */
export async function flush(): Promise<void> {
  if (flushing || stopped || !send || !isOnline()) return;

  flushing = true;
  await publish();

  try {
    let progressed = false;

    // Re-peeked each pass rather than taken as a list: an op can cancel others
    // as it settles, and a stale list would send something the queue has
    // already decided not to.
    for (;;) {
      const op = await peekNext();
      if (!op) break;

      const keepGoing = await sendOne(op);
      progressed = true;
      await publish();
      if (!keepGoing) return;
    }

    backoff = BACKOFF_START_MS;
    if (progressed && (await pendingCount()) === 0) {
      for (const listener of [...drainedListeners]) {
        try { listener(); } catch { /* a failed reconcile is not a failed sync */ }
      }
    }
  } finally {
    flushing = false;
    await publish();
    // Anything still waiting means the drain stopped on an unreachable server.
    if ((await pendingCount()) > 0 && !stopped) schedule();
  }
}

function schedule(): void {
  if (retryTimer !== null) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flush();
  }, jitter(backoff));
  backoff = nextBackoff(backoff);
}

/**
 * Starts the flusher.
 *
 * Triggers, and the one that is missing. `visibilitychange` is deliberately not
 * here: on web it fires on every tab switch, which would beat the backoff into
 * a tight loop against a server that is genuinely down. `online` and the app
 * resume are the honest signals, and the backoff timer covers the rest.
 */
export function startFlusher(): () => void {
  stopped = false;
  const unsubscribe = subscribe(online => {
    void publish();
    if (online) {
      // A fresh connection deserves a fresh first attempt, not whatever delay
      // the previous outage had escalated to.
      backoff = BACKOFF_START_MS;
      void flush();
    }
  });

  void flush();
  return () => {
    unsubscribe();
    if (retryTimer !== null) clearTimeout(retryTimer);
    retryTimer = null;
  };
}

/** Re-arms after a sign-in, since an `auth` failure stopped the loop. */
export function resumeAfterAuth(): void {
  stopped = false;
  backoff = BACKOFF_START_MS;
  void flush();
}

/** A hand-triggered retry, from the banner's "try now". */
export function retryNow(): void {
  backoff = BACKOFF_START_MS;
  if (retryTimer !== null) { clearTimeout(retryTimer); retryTimer = null; }
  void flush();
}

/** Test seam. */
export function resetFlusher(): void {
  if (retryTimer !== null) clearTimeout(retryTimer);
  retryTimer = null;
  flushing = false;
  stopped = false;
  backoff = BACKOFF_START_MS;
  send = null;
  idListeners.clear();
  drainedListeners.clear();
}

export { publish as publishSyncState };
