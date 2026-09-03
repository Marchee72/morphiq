/**
 * The two names a row has before the server gives it one.
 *
 * `clientId` is the idempotency key: chosen before the first send, stored on
 * the row, and what lets the server recognise a replay as the same write rather
 * than a second one.
 *
 * `tempId` is the local placeholder the app renders and references until the
 * real id arrives. It is derived from the `clientId` rather than generated
 * separately, so the flusher never has to correlate the two through a lookup —
 * given either, it has both.
 */

/**
 * The prefix that marks an id as not-yet-real.
 *
 * Deliberately not digits. Server ids are `SERIAL`, and `guardRow` in
 * `server/auth.js` tests `/^\d+$/` — an id that failed that test would skip the
 * ownership check entirely and then 500 in the handler. Nothing should ever
 * send one, but if the invariant breaks, it must break somewhere loud rather
 * than being mistaken for a real row.
 *
 * It must also stay distinguishable from `'pending'`, the literal
 * `workoutLogId` the app files un-linked routine sets under.
 */
const TEMP_PREFIX = 'tmp_';

let fallbackCounter = 0;

/**
 * A key the server has never seen.
 *
 * `crypto.randomUUID` where it exists, which is everywhere the app actually
 * runs. The fallback is not for correctness in some exotic browser — it is
 * because this is called on the write path of a workout, and throwing here
 * would lose the set. Time plus randomness plus a counter is unique enough for
 * a queue on one device, which is the only scope that matters: the unique index
 * behind it is scoped to a profile, not to the world.
 */
export function newClientId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid;
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${fallbackCounter++}`;
}

export function tempIdFor(clientId: string): string {
  return `${TEMP_PREFIX}${clientId}`;
}

export function isTempId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(TEMP_PREFIX);
}

/** The `clientId` a temp id was derived from. */
export function clientIdFromTemp(tempId: string): string {
  return tempId.slice(TEMP_PREFIX.length);
}
