/**
 * A one-line answer to "is there anything cached, and is it ours".
 *
 * The auth gate has to decide whether to show the app or the sign-in wall on
 * the *first* render. Opening IndexedDB to find out is asynchronous, and an
 * asynchronous answer means the wall paints first and the app replaces it a
 * frame later — the flash `sessionPersistence.ts` avoids for the same reason,
 * by the same means.
 *
 * So the real cache lives in IndexedDB and this mirrors just enough of its
 * existence into localStorage to be read synchronously.
 *
 * Every access is wrapped, following `preferences.ts` and
 * `sessionPersistence.ts`: private-mode Safari and some WebViews throw on
 * storage access rather than returning null, and a failed read here must
 * degrade to "no cache" rather than taking the boot down.
 */

import { getToken, getUser } from '../auth/session';

const KEY = 'morphiq_snapshot_meta';

export interface SnapshotMarker {
  /**
   * The account the cache was filled under.
   *
   * The load-bearing field. IndexedDB is per-browser and an account is not, so
   * without this a second person signing in on a shared phone would be one
   * offline launch away from the first person's training history.
   */
  userId: number;
  /** Which profiles have rows cached, so the gate knows there is an app to show. */
  profileIds: string[];
  savedAt: string;
}

export function readMarker(): SnapshotMarker | null {
  if (typeof window === 'undefined') return null;

  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<SnapshotMarker>;
    if (typeof parsed.userId !== 'number' || !Array.isArray(parsed.profileIds)) return null;
    return {
      userId: parsed.userId,
      profileIds: parsed.profileIds.filter((id): id is string => typeof id === 'string'),
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date(0).toISOString(),
    };
  } catch {
    // Truncated or hand-edited. Drop it rather than failing to parse on every
    // launch from here on.
    clearMarker();
    return null;
  }
}

export function writeMarker(profileIds: string[]): void {
  if (typeof window === 'undefined') return;
  const user = getUser();
  // Nothing to stamp it with is nothing worth recording: an unstamped marker
  // could never be safely served, so writing one would only be a way to get the
  // identity check wrong later.
  if (!user) return;

  try {
    localStorage.setItem(KEY, JSON.stringify({
      userId: user.id,
      profileIds,
      savedAt: new Date().toISOString(),
    } satisfies SnapshotMarker));
  } catch {
    // Quota, or a locked-down WebView. The cache itself is still being written;
    // only the ability to boot offline against it is lost, and that degrades to
    // exactly the behaviour that existed before any of this.
  }
}

export function clearMarker(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // A stale marker is caught by the identity check in `canEnterOffline`.
  }
}

/**
 * Whether the app may open without reaching the server.
 *
 * All three conditions, and the third is the one that matters. A token says
 * this browser was signed in; a marker says there is data to show; the *match*
 * between them is what says the data belongs to whoever is holding the token.
 *
 * Note what this does not claim: nothing here has been authorised by the server
 * just now. The token was accepted the last time anyone could ask. That is the
 * deliberate trade — the app opens over data the account already had, and every
 * write goes to the outbox rather than being trusted onward.
 */
export function canEnterOffline(): boolean {
  const user = getUser();
  if (!getToken() || !user) return false;

  const marker = readMarker();
  return marker !== null
    && marker.userId === user.id
    && marker.profileIds.length > 0;
}
