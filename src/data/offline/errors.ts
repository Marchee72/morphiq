/**
 * What a failed write means for the queue.
 *
 * The whole offline layer turns on one question: is this worth trying again?
 * Getting it wrong in either direction is bad in a different way. Queue a
 * request the server will always reject and the queue never drains — one
 * malformed payload and every later write is stuck behind it forever. Refuse to
 * queue a request that only failed because the gym has no signal and you have
 * thrown away the workout you were meant to protect.
 *
 * So the decision lives here, in one place, rather than being re-derived at
 * each of the nine repositories.
 */

import { ApiError, UnauthorizedError } from '../database/apiClient';

export type Failure =
  /** The session is gone. Stop; do not replay against a token already rejected. */
  | 'auth'
  /** The server answered and will answer the same way forever. Do not queue. */
  | 'permanent'
  /** Nobody said no — the request never got an answer. Queue it. */
  | 'retryable';

/**
 * Statuses that mean "not now" rather than "never".
 *
 * All of these come from the transport or the edge rather than from a handler
 * that looked at the payload and disliked it: a timeout, a rate limit, or one
 * of Vercel's gateway responses when the function is cold, over-concurrent, or
 * mid-deploy. The same request a minute later can succeed unchanged.
 */
const RETRYABLE_STATUSES = new Set([408, 429, 502, 503, 504]);

export function classifyFailure(err: unknown): Failure {
  // A dead session is not a network problem, and it is the one case where
  // retrying is actively wrong: every replay would carry the same token the
  // server has already refused, and `api()` has cleared it besides.
  if (err instanceof UnauthorizedError) return 'auth';

  if (err instanceof ApiError) {
    if (RETRYABLE_STATUSES.has(err.status)) return 'retryable';

    /**
     * Everything else the server answered is permanent — including 500.
     *
     * That looks wrong at a glance, because a 500 usually reads as "try later".
     * Here it does not: `server/index.js` catches every driver error into a 500,
     * so a 500 from these handlers is a payload Postgres refused — a bad type, a
     * violated constraint, a column that does not exist. Replaying it produces
     * the identical 500 on every attempt, and because the queue is FIFO that one
     * op would hold every write behind it hostage. The genuinely transient
     * server-side failures arrive as 502/503/504 from the edge, above.
     */
    return 'permanent';
  }

  // No status line ever arrived: `fetch`'s own TypeError for a dead socket or a
  // refused connection, the AbortError from the request deadline, or anything
  // else the platform raised before the server could answer. None of these are
  // evidence that the request was bad.
  return 'retryable';
}
