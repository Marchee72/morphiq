import { authHeaders, clearSession } from '../auth/session';
import { apiBaseUrl } from './mode';

/**
 * The one way this app talks to its API.
 *
 * Lifted out of `ServerDatabase` when the social repository needed the same
 * thing. A second copy would have worked on the day it was written, and the 401
 * handling below is precisely the part that must not drift between two copies:
 * a repository that forgot it would keep firing requests with a dead token and
 * report each failure as an ordinary error.
 */
export class UnauthorizedError extends Error {
  constructor() { super('Session expired'); this.name = 'UnauthorizedError'; }
}

/**
 * A failure the server answered with a status line.
 *
 * Callers used to get a bare `Error` whose only distinguishing feature was its
 * message, which made "the request was malformed" and "the socket died"
 * indistinguishable. The offline queue has to tell those apart: a 400 will
 * answer the same way forever, so queuing it creates an op that can never
 * drain, while a dead network is precisely what the queue exists for.
 *
 * `message` keeps the value it always had, so nothing that catches today
 * changes behaviour — this is additive.
 */
export class ApiError extends Error {
  // Declared rather than a constructor parameter property: `erasableSyntaxOnly`
  // is on, and that shorthand is the one class syntax it forbids.
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * How long a request may hang before it counts as unreachable.
 *
 * Not cosmetic. Gym wifi behind a captive portal completes the TCP handshake
 * and then never answers, and `fetch` has no deadline of its own: without this
 * a set write waits forever, never rejects, and so never reaches the queue that
 * would have saved it.
 */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * A deadline signal, where the platform has one.
 *
 * `AbortSignal.timeout` is missing in some older WebViews and in a few test
 * environments. Calling it unguarded would throw before the request was ever
 * made — turning a missing convenience into a total outage — so its absence
 * simply restores the previous no-deadline behaviour.
 */
function timeoutSignal(): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    : undefined;
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    ...options,
    // A caller's own signal wins: one that aborts the request itself must not be
    // replaced by a deadline that knows nothing about why it was cancelled.
    signal: options?.signal ?? timeoutSignal(),
    // Merged rather than spread over: `...options` used to sit after `headers`,
    // so any caller passing its own headers would have dropped these.
    headers: {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...authHeaders(),
      ...(options?.headers as Record<string, string> | undefined),
    },
  });

  // A rejected session is not a normal failure: the app has to stop pretending
  // it is signed in, or every subsequent call fails the same way.
  if (res.status === 401) {
    clearSession();
    throw new UnauthorizedError();
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, err.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as T;
}
