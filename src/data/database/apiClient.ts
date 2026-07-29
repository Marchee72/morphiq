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

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBaseUrl()}${path}`, {
    ...options,
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
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as T;
}
