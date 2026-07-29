import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { probeGate } from '../authGate';
import { clearSession, onSessionCleared, setSession } from '../session';

/**
 * Who is allowed past the front door.
 *
 * The client cannot decide this: `AUTH_REQUIRED` lives on the server, and a
 * client that guessed would either lock people out of an open deployment or let
 * a signed-out visitor through to a screen where every request answers 401.
 *
 * These run in local mode (`VITE_DB_TYPE=local`, set by the vitest config), so
 * the server-mode branches are exercised by re-importing the module against a
 * stubbed env rather than by changing the whole suite's configuration.
 */

const USER = { id: 1, email: 'marchee72@gmail.com', name: 'Marche', picture: null };

/**
 * `probeGate` bound to a server-mode build, with `fetch` answering `response`.
 *
 * `isServerMode` is resolved at import time, so the only way to exercise the
 * server branches from a local-mode suite is a fresh module graph. That graph
 * carries its own copy of `session`, which is why the session module is handed
 * back too — asserting against this file's copy would be reading a different
 * instance, and it would report the token as still present.
 */
async function serverProbe(response: Partial<Response> | Error) {
  vi.resetModules();
  vi.stubEnv('VITE_DB_TYPE', 'server');
  vi.stubEnv('VITE_API_URL', 'https://example.test');

  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response as Response;
  });
  vi.stubGlobal('fetch', fetchMock);

  const [{ probeGate: probe }, session] = await Promise.all([
    import('../authGate'),
    import('../session'),
  ]);
  return { status: await probe(), fetchMock, session };
}

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
  clearSession();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('probeGate — local build', () => {
  it('never asks anyone for a sign-in', async () => {
    // There is no server to ask and the data never leaves the browser.
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await probeGate()).toBe('open');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('probeGate — server build', () => {
  it('opens when the deployment does not enforce auth', async () => {
    // The staged rollout: the API is up but still permissive.
    const { status } = await serverProbe(ok({ authRequired: false, user: null }));
    expect(status).toBe('open');
  });

  it('opens when auth is enforced and the session is recognised', async () => {
    const { status } = await serverProbe(ok({ authRequired: true, user: USER }));
    expect(status).toBe('open');
  });

  it('blocks when auth is enforced and nobody is signed in', async () => {
    const { status } = await serverProbe(ok({ authRequired: true, user: null }));
    expect(status).toBe('blocked');
  });

  it('reports offline rather than blocked when the API cannot be reached', async () => {
    // A dead network is not a rejected sign-in — the screen offers "try again"
    // instead of a sign-in button that cannot possibly work.
    const { status } = await serverProbe(new TypeError('Failed to fetch'));
    expect(status).toBe('offline');
  });

  it('reports offline on a server error, which says nothing about the session', async () => {
    const { status } = await serverProbe({ ok: false, status: 500 } as Response);
    expect(status).toBe('offline');
  });

  it('drops a token the server rejects outright', async () => {
    setSession({ token: 'stale', user: USER });
    const { status, session } = await serverProbe({ ok: false, status: 401 } as Response);
    expect(status).toBe('blocked');
    // Left in place, every later request would repeat the same rejection.
    expect(session.getToken()).toBeNull();
  });

  it('drops a token the server does not recognise', async () => {
    setSession({ token: 'stale', user: USER });
    const { status, session } = await serverProbe(ok({ authRequired: true, user: null }));
    expect(status).toBe('blocked');
    expect(session.getToken()).toBeNull();
  });

  it('sends the stored session along', async () => {
    setSession({ token: 'abc123', user: USER });
    const { fetchMock } = await serverProbe(ok({ authRequired: true, user: USER }));

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc123');
  });
});

describe('onSessionCleared', () => {
  it('fires when a live session is dropped, so the wall can go back up', async () => {
    setSession({ token: 'abc', user: USER });
    const listener = vi.fn();
    onSessionCleared(listener);

    clearSession();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when there was nothing to clear', () => {
    // Otherwise the very first `clearSession` at boot would show a signed-out
    // visitor a "your session expired" wall they never had a session for.
    const listener = vi.fn();
    onSessionCleared(listener);
    clearSession();
    expect(listener).not.toHaveBeenCalled();
  });

  it('stops firing once unsubscribed', () => {
    const listener = vi.fn();
    const off = onSessionCleared(listener);
    off();

    setSession({ token: 'abc', user: USER });
    clearSession();
    expect(listener).not.toHaveBeenCalled();
  });
});
