import { describe, expect, it } from 'vitest';
import { classifyFailure } from '../errors';
import { ApiError, UnauthorizedError } from '../../database/apiClient';

/**
 * The one decision the offline queue cannot get wrong.
 *
 * Both mistakes are silent. Classify a permanent failure as retryable and the
 * queue wedges behind an op that can never succeed, taking every later write
 * with it. Classify a transient one as permanent and a logged workout is thrown
 * away with no error the user ever sees.
 */

describe('classifyFailure', () => {
  it('treats a dead session as its own case, never as something to retry', () => {
    // Replaying would send the same token the server has already refused, and
    // `api()` has cleared it by now anyway.
    expect(classifyFailure(new UnauthorizedError())).toBe('auth');
  });

  it.each([400, 403, 404, 409, 422])('refuses to queue a %d — it will never succeed', (status) => {
    expect(classifyFailure(new ApiError(status, 'nope'))).toBe('permanent');
  });

  it('refuses to queue a 500, because these handlers turn bad payloads into one', () => {
    // `server/index.js` catches every driver error into a 500, so a 500 here is
    // a payload Postgres refused — identical on every replay, and the queue is
    // FIFO, so one of them would hold back every write behind it.
    expect(classifyFailure(new ApiError(500, 'invalid input syntax'))).toBe('permanent');
  });

  it.each([408, 429, 502, 503, 504])('queues a %d, which is "not now" rather than "never"', (status) => {
    expect(classifyFailure(new ApiError(status, 'later'))).toBe('retryable');
  });

  it('queues a dead socket', () => {
    // What `fetch` throws when there is no network at all.
    expect(classifyFailure(new TypeError('Failed to fetch'))).toBe('retryable');
  });

  it('queues a request that hit its deadline', () => {
    // The captive-portal case: the handshake completes and nothing follows.
    const abort = new DOMException('The operation was aborted.', 'TimeoutError');
    expect(classifyFailure(abort)).toBe('retryable');
  });

  it('queues anything unrecognisable rather than discarding the write', () => {
    // An unknown throw says nothing about the request being bad, and the cost of
    // being wrong here is a duplicate the clientId already covers — versus a
    // lost workout the other way.
    expect(classifyFailure(new Error('who knows'))).toBe('retryable');
    expect(classifyFailure('a string')).toBe('retryable');
    expect(classifyFailure(undefined)).toBe('retryable');
  });
});
