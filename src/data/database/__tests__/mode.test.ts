import { describe, expect, it, afterEach, vi } from 'vitest';

/**
 * Where the client thinks the API is.
 *
 * This used to be answered three different ways in three files, two of which
 * defaulted to a hardcoded LAN address. A build that forgot `VITE_API_URL` then
 * sent every request to a private IP on the visitor's own network — which fails
 * slowly, as a timeout, and looks like the server being down.
 *
 * Resolved at call time, but read from module-level env, so each case needs a
 * fresh module graph.
 */
async function resolve(env: Record<string, string | undefined>, href?: string) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) vi.stubEnv(key, '');
    else vi.stubEnv(key, value);
  }
  if (href) {
    const url = new URL(href);
    vi.stubGlobal('window', {
      ...globalThis.window,
      location: { origin: url.origin, hostname: url.hostname, search: url.search },
    });
  }
  const { apiBaseUrl } = await import('../mode');
  return apiBaseUrl();
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('apiBaseUrl', () => {
  it('uses the configured URL when the build sets one', async () => {
    // Android needs this: the app is served from localhost inside the WebView,
    // so same-origin would mean the WebView itself.
    expect(await resolve({ VITE_API_URL: 'https://morphiq-eight.vercel.app' }))
      .toBe('https://morphiq-eight.vercel.app');
  });

  it('trims a trailing slash, so paths do not end up doubled', async () => {
    expect(await resolve({ VITE_API_URL: 'https://example.test/' })).toBe('https://example.test');
  });

  it('falls back to the page origin when the API ships alongside the app', async () => {
    // What the Vercel deployment does. No env var to set, none to forget.
    expect(await resolve({ VITE_API_URL: undefined }, 'https://morphiq.example/today'))
      .toBe('https://morphiq.example');
  });

  it('does not treat the dev server as its own API', async () => {
    // Vite on :5173 serves the app; the Express server is a separate process.
    expect(await resolve({ VITE_API_URL: undefined }, 'http://localhost:5173/'))
      .toBe('http://localhost:3000');
  });

  it('never invents a private LAN address', async () => {
    const url = await resolve({ VITE_API_URL: undefined }, 'https://morphiq.example/');
    expect(url).not.toContain('192.168');
  });
});

describe('isServerMode', () => {
  it('is off unless the build asks for it', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_DB_TYPE', 'local');
    expect((await import('../mode')).isServerMode).toBe(false);
  });

  it('is on for a server build', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_DB_TYPE', 'server');
    vi.stubGlobal('window', { ...globalThis.window, location: { ...window.location, search: '' } });
    expect((await import('../mode')).isServerMode).toBe(true);
  });

  it('honours ?db=local as the escape hatch from a broken backend', async () => {
    // Without it, a server build against a dead API is unusable: no way in, and
    // no way to reach the data already on the device.
    vi.resetModules();
    vi.stubEnv('VITE_DB_TYPE', 'server');
    vi.stubGlobal('window', { ...globalThis.window, location: { ...window.location, search: '?db=local' } });
    expect((await import('../mode')).isServerMode).toBe(false);
  });
});
