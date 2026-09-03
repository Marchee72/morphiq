/**
 * The last thing the app knew, kept so it can be shown again without a network.
 *
 * Filled by the reads themselves rather than by a separate "save a snapshot"
 * step. Every successful load through a decorated repository writes what it got
 * here, which means the cache is populated by exactly the code paths that
 * already load the app, it can never disagree with what the repositories
 * return, and there is no second serialization format to keep in step.
 *
 * Rows go in as the repositories hand them over — already `Date`-parsed by
 * `ServerDatabase`'s `parse*` helpers. IndexedDB structured-clones a `Date`
 * natively, so unlike `sessionPersistence.ts` there is no revive step here, and
 * so no revive step to forget when a field is added.
 *
 * This deliberately reverses a decision made twice elsewhere: `sw.js` and the
 * API's `Cache-Control: no-store` both refuse to store a response because a
 * cache is per-browser and an account is not. The account stamp below is what
 * pays for the reversal.
 */

import { getUser } from '../auth/session';
import { offlineDb } from './offlineDb';
import { PROFILE_PARTITION, type CachedRow, type RowKind } from './types';
import { writeMarker } from './snapshotMarker';

/**
 * How a read updates its partition.
 *
 * `replace` for a read that asked for everything of its kind — the answer is
 * the complete truth, so anything not in it is gone. `merge` for a filtered or
 * windowed read: a single day's workouts are not evidence about any other day,
 * and letting them replace the partition would throw away the history the user
 * came to look at.
 */
export type CacheMode = 'replace' | 'merge';

const rowKey = (kind: RowKind, id: string) => `${kind}:${id}`;

/** The id a row is filed under, whatever shape the entity gave it. */
function idOf(row: Record<string, unknown>): string | null {
  const id = row.id;
  if (typeof id === 'string' && id.length > 0) return id;
  if (typeof id === 'number') return String(id);
  return null;
}

/**
 * Refuses to touch a cache belonging to somebody else.
 *
 * Checked on every read and every write, not just at boot. A session can change
 * underneath a running app — a 401 clears it, a second account signs in — and a
 * check that only ran once would keep serving the previous account's rows until
 * the next launch.
 */
async function stampMatches(): Promise<boolean> {
  const user = getUser();
  if (!user) return false;

  const stamp = await offlineDb().meta.get('account');
  if (!stamp) {
    // First write of this session. Claim the cache for whoever is signed in.
    await offlineDb().meta.put({ key: 'account', userId: user.id, savedAt: new Date() });
    return true;
  }
  return stamp.userId === user.id;
}

/**
 * Files what a read returned.
 *
 * Failures are swallowed on purpose. This runs inside the read path of every
 * screen: a full disk or a WebView that refuses storage must cost the user
 * their offline copy, not the data they asked for.
 */
export async function cacheRows(
  kind: RowKind,
  profileId: string,
  rows: Record<string, unknown>[],
  mode: CacheMode,
): Promise<void> {
  try {
    if (!(await stampMatches())) return;
    const db = offlineDb();

    const incoming: CachedRow[] = [];
    for (const row of rows) {
      const id = idOf(row);
      // A row with no id cannot be addressed later — not by an update, not by a
      // delete, not by the partition read. Caching it would only produce a
      // duplicate the next time the same read runs.
      if (id === null) continue;
      incoming.push({ key: rowKey(kind, id), kind, profileId, data: row });
    }

    await db.transaction('rw', db.rows, async () => {
      if (mode === 'replace') {
        const keep = new Set(incoming.map(r => r.key));
        const stale = (await db.rows.where({ profileId, kind }).toArray())
          .filter(r => !keep.has(r.key))
          .map(r => r.key);
        if (stale.length > 0) await db.rows.bulkDelete(stale);
      }
      if (incoming.length > 0) await db.rows.bulkPut(incoming);
    });

    if (kind === 'profile') {
      // The marker exists so the boot gate can answer synchronously, and the
      // only fact it needs is which profiles there are to show.
      writeMarker(incoming.map(r => idOf(r.data)).filter((id): id is string => id !== null));
    }
  } catch {
    // Nothing to tell the user: they asked for their data and they got it.
  }
}

/** Files one row — the optimistic copy of something just written. */
export async function cacheRow(
  kind: RowKind,
  profileId: string,
  row: Record<string, unknown>,
): Promise<void> {
  await cacheRows(kind, profileId, [row], 'merge');
}

/**
 * Everything cached of one kind for one profile.
 *
 * Empty when the cache belongs to another account, which is the whole point of
 * the stamp: the caller sees "nothing cached", not somebody else's rows.
 */
export async function readPartition<T>(kind: RowKind, profileId: string): Promise<T[]> {
  try {
    if (!(await stampMatches())) return [];
    const rows = await offlineDb().rows.where({ profileId, kind }).toArray();
    return rows.map(r => r.data as T);
  } catch {
    return [];
  }
}

/**
 * Every cached row of one kind, whatever profile it belongs to.
 *
 * For the reads that name no profile: `getForWorkout(workoutLogId)` and
 * `deleteForWorkout` address a workout, and the interface gives them nothing
 * else to scope by. On one device that is a small scan over one kind.
 */
export async function readAllOfKind<T>(kind: RowKind): Promise<T[]> {
  try {
    if (!(await stampMatches())) return [];
    const rows = await offlineDb().rows.where('kind').equals(kind).toArray();
    return rows.map(r => r.data as T);
  } catch {
    return [];
  }
}

export async function evictRow(kind: RowKind, id: string): Promise<void> {
  try {
    await offlineDb().rows.delete(rowKey(kind, id));
  } catch { /* the row stays until the next complete read replaces the partition */ }
}

/**
 * Drops every row of a kind the predicate matches — a cascade, locally.
 *
 * `profileId` is nullable because the reads this mirrors are: `deleteForWorkout`
 * names a workout and no profile, so there is nothing to scope the sweep by.
 */
export async function evictWhere(
  kind: RowKind,
  profileId: string | null,
  match: (row: Record<string, unknown>) => boolean,
): Promise<void> {
  try {
    const db = offlineDb();
    const candidates = profileId === null
      ? await db.rows.where('kind').equals(kind).toArray()
      : await db.rows.where({ profileId, kind }).toArray();

    const doomed = candidates.filter(r => match(r.data)).map(r => r.key);
    if (doomed.length > 0) await db.rows.bulkDelete(doomed);
  } catch { /* as above */ }
}

/**
 * Re-files a row under the id the server gave it.
 *
 * The optimistic copy was keyed by a temp id. Left there, the next complete
 * read would delete it as stale and the row would blink out and back in.
 */
export async function rekeyRow(kind: RowKind, tempId: string, serverId: string): Promise<void> {
  try {
    const db = offlineDb();
    const existing = await db.rows.get(rowKey(kind, tempId));
    if (!existing) return;
    await db.transaction('rw', db.rows, async () => {
      await db.rows.delete(existing.key);
      await db.rows.put({
        ...existing,
        key: rowKey(kind, serverId),
        data: { ...existing.data, id: serverId },
      });
    });
  } catch { /* the next complete read reconciles it */ }
}

/**
 * Rewrites a foreign key across a partition after its target was resolved.
 *
 * The sets of a workout logged offline all point at the log's temp id. When the
 * log lands and gets a real one, they have to follow — otherwise the session
 * screen asks for the sets of a workout id nothing is filed under.
 */
export async function rewriteRefs(
  kind: RowKind,
  profileId: string,
  field: string,
  from: string,
  to: string,
): Promise<void> {
  try {
    const db = offlineDb();
    const affected = (await db.rows.where({ profileId, kind }).toArray())
      .filter(r => r.data[field] === from);
    if (affected.length === 0) return;
    await db.rows.bulkPut(affected.map(r => ({ ...r, data: { ...r.data, [field]: to } })));
  } catch { /* the next complete read reconciles it */ }
}

/** Which profiles have anything cached. */
export async function cachedProfileIds(): Promise<string[]> {
  try {
    if (!(await stampMatches())) return [];
    const rows = await offlineDb().rows.where({ profileId: PROFILE_PARTITION, kind: 'profile' }).toArray();
    return rows.map(r => idOf(r.data)).filter((id): id is string => id !== null);
  } catch {
    return [];
  }
}
