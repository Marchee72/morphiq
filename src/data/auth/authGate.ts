import { apiBaseUrl, isServerMode } from '../database/mode';
import { authHeaders, clearSession, getToken } from './session';

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
  /** The API could not be reached, so the question is unanswered. */
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
      return 'offline';
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
    return 'offline';
  }
}
