import { apiBaseUrl, isServerMode } from '../database/mode';
import { authHeaders, clearSession, getToken } from './session';
import { canEnterOffline } from '../offline/snapshotMarker';

/**
 * Whether this build may show the app at all without a signed-in account.
 *
 * The server decides, not the client: `AUTH_REQUIRED` is a backend variable, and
 * a client that guessed would either lock people out of an open deployment or —
 * worse — let them through to a screen where every request 401s. Asking removes
 * the guess.
 */

export type GateStatus =
  /** Still asking the server. */
  | 'checking'
  /** Local build, open deployment, or already signed in. */
  | 'open'
  /** The API demands a session and this browser has none. */
  | 'blocked'
  /**
   * Unreachable, but this device holds a token and a snapshot taken under it.
   *
   * Nothing here has been authorised just now — the token was accepted the last
   * time anyone could ask. That is the deliberate trade: the app opens over data
   * the account already had, and every write goes to the outbox rather than
   * being trusted onward. A gym with no signal is the ordinary case, and a
   * "cannot reach the server" wall in front of a workout is the wrong answer to
   * it.
   */
  | 'offline-cached'
  /** Unreachable, and nothing cached to fall back on. */
  | 'offline';

interface AuthMe {
  authRequired: boolean;
  user: { id: number } | null;
}

/**
 * Asks the API who we are.
 *
 * Answers `open` immediately in local mode — there is no server to ask, and the
 * data never leaves the browser, so there is nothing to sign in to.
 */
export async function probeGate(signal?: AbortSignal): Promise<GateStatus> {
  if (!isServerMode) return 'open';

  try {
    const res = await fetch(`${apiBaseUrl()}/api/auth/me`, {
      headers: { 'ngrok-skip-browser-warning': 'true', ...authHeaders() },
      signal,
    });
    if (!res.ok) {
      // A 401 here means the stored token is no longer good. Dropping it stops
      // every later request repeating the same rejection.
      if (res.status === 401) {
        clearSession();
        return 'blocked';
      }
      // A 5xx says nothing about the session — the server is simply not
      // answering — so it is the same case as a dead socket below.
      return offlineStatus();
    }

    const me = await res.json() as AuthMe;
    if (!me.authRequired) return 'open';
    if (me.user) return 'open';

    // The server wants a session and does not recognise ours.
    if (getToken()) clearSession();
    return 'blocked';
  } catch {
    // A dead network is not a rejected sign-in. Saying so lets the screen offer
    // "try again" rather than a sign-in button that cannot possibly work.
    return offlineStatus();
  }
}

/**
 * Unreachable — with or without something to show.
 *
 * `canEnterOffline` reads localStorage synchronously, deliberately. The gate
 * decides on the first render, and an asynchronous check against IndexedDB
 * would paint the sign-in wall and swap it for the app a frame later. It also
 * checks the snapshot's account stamp against the signed-in user, which is what
 * keeps a shared phone from showing the last person's training history.
 */
function offlineStatus(): GateStatus {
  return canEnterOffline() ? 'offline-cached' : 'offline';
}
