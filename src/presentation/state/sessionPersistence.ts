/**
 * The workout in progress, kept across app restarts.
 *
 * Until this existed, `activeSession` lived only in memory: closing the app
 * mid-workout — or the Android WebView being killed to reclaim memory, which
 * needs no closing at all — lost every set logged. That is the worst thing this
 * app can do, so the session is written out on every change.
 *
 * localStorage rather than Dexie, and manual rather than zustand `persist`, for
 * three reasons. The read has to be synchronous so `pendingResume` is already
 * populated on the first render and the resume sheet does not flash in late.
 * `startTime` is a `Date`, which JSON does not round-trip, so a custom revive
 * step is needed either way. And the restored session must land in a staging
 * slot for the user to accept or reject — `persist` would put it straight back
 * into `activeSession`, which is the one thing that must not happen silently.
 *
 * Follows the storage style of `preferences.ts`: every access wrapped, because
 * private-mode Safari and some WebViews throw on access rather than returning
 * null, and a failed write must never take a workout down with it.
 */

import type { ActiveSession } from './store';

const KEY = 'morphiq_active_session';

export interface StoredSession {
  /**
   * Whose session this is.
   *
   * Without it, signing into a second profile on the same device would offer to
   * resume the first one's workout — and then file it under the wrong account.
   */
  profileId: string;
  /** When it was last written, so the sheet can say how long ago it stopped. */
  savedAt: Date;
  session: ActiveSession;
}

/** A `Date` back from whatever JSON left behind, or undefined if it is unusable. */
function reviveDate(raw: unknown): Date | undefined {
  if (typeof raw !== 'string' && typeof raw !== 'number') return undefined;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * The stored session, or null when there is none worth restoring.
 *
 * Deliberately strict: a session with no sets is nothing to resume, and a
 * payload that has lost its `startTime` or its `sets` array would crash the
 * screens that read it. Both cases return null rather than a half a session —
 * the user simply gets no prompt, which is the same as before this existed.
 */
export function readStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;

  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    const session = parsed.session;
    if (!parsed.profileId || !session || !Array.isArray(session.sets)) return null;

    const startTime = reviveDate(session.startTime);
    if (!startTime) return null;

    // Nothing logged is nothing to offer. `finishActiveSession` discards these
    // too, so resuming one could only ever lead to the same discard.
    if (session.sets.length === 0) return null;

    return {
      profileId: parsed.profileId,
      savedAt: reviveDate(parsed.savedAt) ?? startTime,
      session: { ...session, startTime },
    };
  } catch {
    // Truncated or hand-edited JSON. Drop it rather than leaving a payload
    // that fails to parse on every launch from here on.
    clearStoredSession();
    return null;
  }
}

export function writeStoredSession(profileId: string, session: ActiveSession): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ profileId, savedAt: new Date(), session }));
  } catch {
    // Quota or a locked-down WebView. The session stays live in memory; only
    // its ability to survive a restart is lost, and there is nothing useful to
    // tell the user mid-set about it.
  }
}

export function clearStoredSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do — a stale entry is caught by the guards in `readStoredSession`.
  }
}
