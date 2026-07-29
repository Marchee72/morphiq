/**
 * The app session, held outside React so `ServerDatabase`'s plain `fetch`
 * wrapper can reach it.
 *
 * A bearer token rather than a cookie: the Capacitor WebView serves the app from
 * `http://localhost`, which makes `SameSite` on a cross-site cookie a fight not
 * worth having. One mechanism that works identically on web and on device.
 */
const TOKEN_KEY = 'morphiq_session';
const USER_KEY = 'morphiq_user';

export interface AuthUser {
  id: number;
  email: string | null;
  name: string | null;
  picture: string | null;
}

let token: string | null = read(TOKEN_KEY);
let user: AuthUser | null = readJson<AuthUser>(USER_KEY);

function read(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}

function readJson<T>(key: string): T | null {
  const raw = read(key);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

function write(key: string, value: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* private mode; the session simply will not persist */ }
}

export function getToken(): string | null {
  return token;
}

export function getUser(): AuthUser | null {
  return user;
}

export function setSession(next: { token: string; user: AuthUser }): void {
  token = next.token;
  user = next.user;
  write(TOKEN_KEY, next.token);
  write(USER_KEY, JSON.stringify(next.user));
}

/**
 * Told when the session goes away, so the app can put the sign-in wall back up.
 *
 * `ServerDatabase` clears the session from inside a `fetch` wrapper that knows
 * nothing about React. Without this, an expired token left every screen quietly
 * failing its loads — signed out in fact, still signed in as far as the UI was
 * concerned.
 */
type Listener = () => void;
const cleared = new Set<Listener>();

export function onSessionCleared(listener: Listener): () => void {
  cleared.add(listener);
  return () => { cleared.delete(listener); };
}

export function clearSession(): void {
  const had = token !== null;
  token = null;
  user = null;
  write(TOKEN_KEY, null);
  write(USER_KEY, null);
  // Only when something was actually lost: a clear on an already-signed-out
  // session is not an event anyone needs to react to.
  if (had) for (const listener of [...cleared]) listener();
}

/** Headers for an authenticated request. Empty while signed out. */
export function authHeaders(): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
