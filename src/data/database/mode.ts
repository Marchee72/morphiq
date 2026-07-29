/**
 * Which storage the app is talking to, decided once at import time.
 *
 * Lived as a private `const` inside `store.ts`, which was fine until the auth
 * gate needed the same answer: a sign-in wall only makes sense against the
 * server, and a second copy of this expression is a second thing to get wrong.
 *
 * `?db=local` is the escape hatch. It exists because a server-mode build with a
 * broken backend was otherwise unusable — no way in, and no way to see your own
 * device's data.
 */
export const isServerMode: boolean =
  (import.meta.env?.VITE_DB_TYPE as string) === 'server'
  && !(typeof window !== 'undefined' && window.location.search.includes('db=local'));

/**
 * Where the API lives.
 *
 * Three copies of this used to exist — `ServerDatabase`, `googleSignIn` and
 * `main.tsx` — and they disagreed. Two defaulted to a hardcoded LAN address
 * (`http://192.168.100.142:3000`), which is a fine default on the author's sofa
 * and a broken one everywhere else: a build shipped without `VITE_API_URL` sent
 * every request to a private IP on the visitor's own network.
 *
 * Resolution order:
 *   1. `VITE_API_URL`, when the build sets one. Required on Android, where the
 *      app is served from `http://localhost` inside the WebView and same-origin
 *      would mean the WebView itself.
 *   2. The page's own origin, for a web build served alongside the API — which
 *      is what the Vercel deployment does. No configuration, nothing to forget.
 *   3. A local dev server.
 */
export function apiBaseUrl(): string {
  const configured = (import.meta.env?.VITE_API_URL as string | undefined)?.trim();
  if (configured) return configured.replace(/\/$/, '');

  if (typeof window !== 'undefined' && window.location.origin.startsWith('http')) {
    const { origin, hostname } = window.location;
    // A dev server on :5173 is not also serving the API.
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') return origin;
  }

  return 'http://localhost:3000';
}
