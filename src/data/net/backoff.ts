/**
 * How long to wait before trying the server again.
 *
 * Extracted from `socialStream`, which had the only copy, when the offline
 * flusher needed the same thing. Both are retry loops against the same API from
 * the same device, and two sets of constants would eventually disagree — the
 * failure mode being that one of them hammers a server the other has correctly
 * decided to back off from.
 */

export const BACKOFF_START_MS = 1_000;
export const BACKOFF_MAX_MS = 30_000;

/** ±20%, so a hundred clients dropped by one outage do not return in lockstep. */
export function jitter(ms: number): number {
  return Math.round(ms * (0.8 + Math.random() * 0.4));
}

/** The next delay after a failure, capped. */
export function nextBackoff(current: number): number {
  return Math.min(current * 2, BACKOFF_MAX_MS);
}
