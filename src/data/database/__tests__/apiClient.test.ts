import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { ApiError, UnauthorizedError, api } from '../apiClient';
import { clearSession, getToken, setSession } from '../../auth/session';

/**
 * The single door every request goes through.
 *
 * Two of its behaviours are load-bearing for things far away from here. The 401
 * handling is what stops a dead token being retried forever by nine
 * repositories that each thought they were seeing an ordinary error. And the
 * status carried on `ApiError` is what lets the offline queue tell "the payload
 * was bad" from "the network was gone" — a distinction it cannot make from a
 * message string, and one it must get right in both directions.
 */

const USER = { id: 1, email: 'marchee72@gmail.com', name: 'Marche', picture: null };

/** A `fetch` answering exactly once with `response`. */
function respond(response: Partial<Response>) {
  const mock = vi.fn(async () => response as Response);
  vi.stubGlobal('fetch', mock);
  return mock;
}

beforeEach(() => {
  clearSession();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api', () => {
  it('returns the parsed body on success', async () => {
    respond({ ok: true, status: 200, json: async () => ({ id: '7' }) });
    await expect(api<{ id: string }>('/api/thing')).resolves.toEqual({ id: '7' });
  });

  it('returns undefined for a 204 rather than trying to parse an empty body', async () => {
    // `res.json()` on an empty response throws. Every DELETE in the app relies
    // on this branch.
    respond({ ok: true, status: 204, json: async () => { throw new Error('no body'); } });
    await expect(api('/api/thing', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('carries the status on the error, not just a message', async () => {
    respond({ ok: false, status: 400, json: async () => ({ error: 'bad shape' }) });

    const err = await api('/api/thing').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(400);
  });

  it('keeps the message it always had, so existing catch sites are unaffected', async () => {
    // `ApiError` was added underneath callers that only ever read `.message`.
    respond({ ok: false, status: 400, json: async () => ({ error: 'bad shape' }) });
    await expect(api('/api/thing')).rejects.toThrow('bad shape');
  });

  it('falls back to the status when the body is not JSON', async () => {
    respond({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      json: async () => { throw new SyntaxError('not json'); },
    });

    const err = await api('/api/thing').catch((e: unknown) => e) as ApiError;
    // The status is what the offline layer classifies on, so it has to survive
    // an unparseable body — which is exactly what a gateway error looks like.
    expect(err.status).toBe(502);
    expect(err.message).toBe('Bad Gateway');
  });

  it('drops the session on a 401 and says so in its own error type', async () => {
    setSession({ token: 'stale', user: USER });
    respond({ ok: false, status: 401, json: async () => ({ error: 'nope' }) });

    await expect(api('/api/thing')).rejects.toBeInstanceOf(UnauthorizedError);
    // Left in place, every later request would repeat the same rejection.
    expect(getToken()).toBeNull();
  });

  it('does not report a rejected session as an ordinary status failure', async () => {
    // `classifyFailure` branches on `UnauthorizedError` first; if a 401 arrived
    // as an `ApiError` it would be classified 'permanent' and the queue would
    // silently discard writes instead of holding them for a re-signin.
    respond({ ok: false, status: 401, json: async () => ({ error: 'nope' }) });
    await expect(api('/api/thing')).rejects.not.toBeInstanceOf(ApiError);
  });

  it('gives the request a deadline of its own', async () => {
    // Without one, a captive portal that completes the handshake and never
    // answers leaves a set write pending forever — it never rejects, so it never
    // reaches the queue that would have saved it.
    const mock = respond({ ok: true, status: 200, json: async () => ({}) });
    await api('/api/thing');

    const [, init] = mock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("leaves a caller's own signal alone", async () => {
    // A caller that can cancel its own request knows why; replacing that with a
    // blind deadline would abort for a reason it cannot act on.
    const controller = new AbortController();
    const mock = respond({ ok: true, status: 200, json: async () => ({}) });
    await api('/api/thing', { signal: controller.signal });

    const [, init] = mock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);
  });

  it('still sends the session and the default headers alongside a caller\'s own', async () => {
    setSession({ token: 'abc123', user: USER });
    const mock = respond({ ok: true, status: 200, json: async () => ({}) });
    await api('/api/thing', { headers: { 'X-Custom': '1' } });

    const [, init] = mock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer abc123');
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Custom']).toBe('1');
  });
});
