import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { AccountStamp, CachedRow, IdMapping, OutboxOp } from './types';

/**
 * Where the app keeps what it could not send, and what it last knew.
 *
 * A second database rather than a version 8 of `MorphIQDatabase`, and the
 * distinction is not cosmetic. That database is a local-mode user's *only copy*
 * of their own data. Bumping its version runs an upgrade transaction on every
 * local-mode device for a feature those devices never use, and a mistake in
 * that upgrade destroys training history that exists nowhere else. It would
 * also put two unrelated things in one schema: rows the user authored, keyed by
 * an autoincrementing local number, next to a disposable copy of the server's
 * rows, keyed by the server's ids.
 *
 * Separating them also makes the privacy rule enforceable. `sw.js` and the API
 * both refuse to cache a response on the grounds that a cache is per-browser
 * and an account is not — this database deliberately reverses that, so it has
 * to be droppable in one call when the session ends, without touching anything
 * a local-mode user would miss.
 */
export class OfflineDatabase extends Dexie {
  rows!: Table<CachedRow, string>;
  ops!: Table<OutboxOp, number>;
  ids!: Table<IdMapping, string>;
  meta!: Table<AccountStamp, string>;

  constructor() {
    super(OFFLINE_DB_NAME);
    this.version(1).stores({
      // `[profileId+kind]` is how this table is read almost everywhere: one
      // partition at a time. The plain `key` is the primary key, so a re-read
      // of the same server row overwrites rather than accumulating.
      //
      // `kind` on its own is for the reads whose signature has no profile to
      // scope by — `getForWorkout(workoutLogId)` and `deleteForWorkout` name a
      // workout and nothing else. Scanning one kind on one device is cheap;
      // inventing a profile to look them up under would not be.
      rows: 'key, [profileId+kind], kind',
      // `++seq` first because ordering *is* the contract here — a set that
      // overtook the workout it belongs to would reference a row that does not
      // exist yet.
      //
      // Ordered globally rather than per profile, which is not the obvious
      // choice and is the safe one. Half the repository methods delete by id
      // alone — `IMeasurementRepository.delete(id)` names no profile, and
      // neither does the interface anywhere else — so a per-profile queue would
      // have to invent a partition for those, and a delete filed apart from the
      // insert it cancels is a delete that never cancels it. One device writes
      // one profile at a time anyway, so the split bought nothing.
      ops: '++seq, status, tempId, clientId',
      ids: 'tempId',
      meta: 'key',
    });
  }
}

export const OFFLINE_DB_NAME = 'MorphIQOffline';

let instance: OfflineDatabase | null = null;

/**
 * The database, opened on first use.
 *
 * Lazy rather than a module-level `new`, because this module is imported by the
 * repository decorators, which are constructed at store import time — before
 * anyone knows whether the app is even in server mode. A local-mode build must
 * not create an IndexedDB database it will never write to.
 */
export function offlineDb(): OfflineDatabase {
  if (!instance) instance = new OfflineDatabase();
  return instance;
}

/**
 * Throws the whole cache away.
 *
 * Called when the session is cleared. Signing out has to take the snapshot with
 * it: IndexedDB is per-browser, so the next person to sign in on a shared phone
 * would otherwise be one boot away from the previous account's training history.
 *
 * Deleting the database rather than clearing its tables, because a queue that
 * survived a sign-out would replay one account's writes under another's token.
 */
export async function resetOfflineDb(): Promise<void> {
  try {
    if (instance) {
      instance.close();
      instance = null;
    }
    await Dexie.delete(OFFLINE_DB_NAME);
  } catch {
    // A blocked delete (another tab holding the database open) or a WebView
    // that refuses storage entirely. The account stamp is checked on every read
    // besides this, so a cache that outlives its session is still never served
    // to the wrong person — this is the tidy-up, not the guarantee.
  }
}
