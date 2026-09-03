/**
 * The shapes the offline layer stores, shared by the modules that write them
 * and the modules that read them back.
 *
 * Kept apart from `offlineDb.ts` so the pure modules — `outbox`, `snapshot` —
 * can name a row without pulling Dexie in behind it.
 */

/**
 * Which repository a cached row or a queued op belongs to.
 *
 * One flat union rather than nine tables, because every read the app makes is
 * "the rows of one kind for one profile" — a shape a single compound index
 * answers, and nine typed tables would answer nine times over.
 */
export type RowKind =
  | 'profile'
  | 'measurement'
  | 'foodLog'
  | 'workoutLog'
  | 'workoutSet'
  | 'message'
  | 'favorite'
  | 'routine'
  | 'wellness';

/** A cached server row, stored as the repository handed it over. */
export interface CachedRow {
  /** `${kind}:${id}` — so a re-read overwrites rather than duplicating. */
  key: string;
  kind: RowKind;
  /**
   * Whose row this is.
   *
   * Profiles are the one kind with no `profileId` of their own; they use the
   * sentinel below, so the partition read stays one query shape for all nine.
   */
  profileId: string;
  data: Record<string, unknown>;
}

/**
 * The partition profiles live in.
 *
 * `getAll()` on profiles takes no argument — it is scoped by the session, not
 * by a profile — so there is no real id to file them under. A sentinel keeps
 * `readPartition` uniform instead of adding a nullable branch to every caller.
 */
export const PROFILE_PARTITION = '__account__';

export type OpKind = 'insert' | 'update' | 'delete' | 'deleteQuery';

export type OpStatus =
  /** Waiting its turn. */
  | 'pending'
  /** Given up on: the server refused it in a way that will not change. */
  | 'failed';

export interface OutboxOp {
  /**
   * The queue order, and the whole contract.
   *
   * Auto-incremented, so it is assigned at write time regardless of what order
   * concurrent `enqueue` calls settle in — which matters because
   * `finishActiveSession` writes its sets through a `Promise.all`.
   */
  seq?: number;
  status: OpStatus;
  kind: RowKind;
  op: OpKind;
  profileId: string;
  /** The idempotency key sent to the server. Inserts only. */
  clientId?: string;
  /** The local placeholder id this op will resolve. Inserts only. */
  tempId?: string;
  /** The row this op addresses. Updates and deletes only; may be a temp id. */
  targetId?: string;
  /** What to send. */
  payload?: Record<string, unknown>;
  /**
   * Payload fields that may hold a temp id and must be rewritten before send.
   *
   * Declared per-op rather than inferred, because only the repository knows
   * which of its fields are foreign keys — `workoutLogId` is one, `exerciseId`
   * points at the static catalogue and is not.
   */
  refs?: string[];
  /** Why it was given up on, for the review sheet. */
  error?: string;
  createdAt: Date;
}

/** A resolved placeholder: what the server actually called the row. */
export interface IdMapping {
  tempId: string;
  serverId: string;
}

/** Who the cache belongs to. Anything else must not be served. */
export interface AccountStamp {
  key: 'account';
  userId: number;
  savedAt: Date;
}
