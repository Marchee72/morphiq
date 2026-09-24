/**
 * How far back a Health Connect import reads.
 *
 * Never less than the caller's own window, re-read in full every time. That is
 * what catches Samsung writing a record with a past timestamp when the watch
 * syncs late — the case a plain `timestamp > lastSync` checkpoint would drop
 * for good (see `HealthSyncWorker.kt`).
 *
 * But also never short of the last sync that went through cleanly. A window
 * alone forgets anything that fell out of it during a gap: a week offline, a
 * run of refused writes, an app nobody opened for a month. So after a gap
 * longer than the window, the read stretches back to where it last succeeded.
 *
 * ponytail: Health Connect only serves data from 30 days before the first
 * permission grant unless READ_HEALTH_DATA_HISTORY is held; a catch-up past
 * that comes back short, not wrong. Request that permission if it matters.
 */

const DAY_MS = 86_400_000;

/** The longest catch-up worth one import pass. */
export const MAX_CATCH_UP_DAYS = 365;

const keyFor = (profileId: string) => `morphiq_health_last_ok_sync_${profileId}`;

function readLastOk(profileId: string): Date | null {
  try {
    const raw = localStorage.getItem(keyFor(profileId));
    const at = raw ? new Date(raw) : null;
    return at && !Number.isNaN(at.getTime()) ? at : null;
  } catch {
    return null;
  }
}

export function syncSince(profileId: string, windowDays: number, now = new Date()): Date {
  let since = now.getTime() - windowDays * DAY_MS;
  const lastOk = readLastOk(profileId);
  // A day of overlap, for records written a little behind the sync that
  // followed them.
  if (lastOk) since = Math.min(since, lastOk.getTime() - DAY_MS);
  return new Date(Math.max(since, now.getTime() - MAX_CATCH_UP_DAYS * DAY_MS));
}

/** Called only when every import succeeded and nothing sits refused in the outbox. */
export function markSyncOk(profileId: string, now = new Date()): void {
  try {
    localStorage.setItem(keyFor(profileId), now.toISOString());
  } catch {
    // Without storage the window simply never stretches — the old behaviour.
  }
}
