/**
 * The nine repositories, wrapped so a dead network stops being fatal.
 *
 * Wrapping the repositories rather than `api()` is the load-bearing choice.
 * `api()` is the narrower seam and looks tempting, but everything goes through
 * it — presence heartbeats that must never be replayed (a resurrected live
 * session is worse than a missing one), push-token registrations, the error
 * log. Intercepting there would mean an allow-list to maintain, and the day
 * someone adds a route and forgets it, the queue starts replaying something it
 * should not. Wrapping the nine excludes all of that by construction.
 *
 * `IDatabase` is also the seam the app already treats as swappable — there are
 * two implementations behind it and one place that picks between them — so the
 * ~90 call sites in `store.ts` are untouched by any of this.
 *
 * Reads: try the network, cache what comes back, fall back to the cache when
 * the network is what failed. Writes: send when the queue is empty and the
 * network is up, otherwise queue and answer from the cache as if it had landed.
 */

import type { UserProfile } from '../../core/entities/UserProfile';
import type { Measurement } from '../../core/entities/Measurement';
import type { FoodLog } from '../../core/entities/FoodLog';
import type { WorkoutLog } from '../../core/entities/WorkoutLog';
import type { Message } from '../../core/entities/Message';
import type { WorkoutSet } from '../../core/entities/WorkoutSet';
import type { FavoriteExercise } from '../../core/entities/FavoriteExercise';
import type { RoutineTemplate } from '../../core/entities/RoutineTemplate';
import type { WellnessLog } from '../../core/entities/WellnessLog';
import type {
  IUserProfileRepository, IMeasurementRepository, IFoodLogRepository,
  IWorkoutLogRepository, IMessageRepository, IWorkoutSetRepository,
  IFavoriteExerciseRepository, IRoutineTemplateRepository, IWellnessLogRepository,
} from '../../core/interfaces/IDatabase';

import { classifyFailure } from './errors';
import { isOnline, reportReachable, reportUnreachable } from './connectivity';
import { cacheRow, cacheRows, evictRow, evictWhere, readAllOfKind, readPartition } from './snapshot';
import { PROFILE_PARTITION, type OutboxOp, type RowKind } from './types';
import { isTempId, newClientId, tempIdFor } from './ids';
import { enqueue, hasPending, lookupId } from './outbox';
import { configureFlusher, publishSyncState } from './flusher';

/** Everything the app's nine repositories are, in one bundle. */
export interface RepositoryBundle {
  profile: IUserProfileRepository;
  measurement: IMeasurementRepository;
  food: IFoodLogRepository;
  workout: IWorkoutLogRepository;
  message: IMessageRepository;
  workoutSet: IWorkoutSetRepository;
  favorite: IFavoriteExerciseRepository;
  routine: IRoutineTemplateRepository;
  wellness: IWellnessLogRepository;
}

interface ReadSpec<T> {
  kind: RowKind;
  profileId: string;
  /**
   * True when the network read asks for a slice rather than everything.
   *
   * Gets the `replace` versus `merge` decision right, and getting it wrong is
   * destructive in a way nothing would report: a dated `getAll` that replaced
   * its partition would delete every other day of cached history the moment the
   * user tapped a date.
   */
  partial: boolean;
  load: () => Promise<T[]>;
  /** The same filter the server applies, for when the cache has to answer. */
  filter?: (rows: T[]) => T[];
}

/**
 * A read that survives the network being gone.
 *
 * Only a `retryable` failure falls back. A 400 or a 403 is the server saying
 * something specific about this request, and quietly answering it from a cache
 * would hide a real bug behind stale data; a 401 has to reach `App.tsx` so the
 * sign-in wall goes back up.
 */
export async function cachedRead<T>(spec: ReadSpec<T>): Promise<T[]> {
  if (isOnline()) {
    try {
      const rows = await spec.load();
      reportReachable();
      await cacheRows(
        spec.kind,
        spec.profileId,
        rows as unknown as Record<string, unknown>[],
        spec.partial ? 'merge' : 'replace',
      );
      return rows;
    } catch (err) {
      if (classifyFailure(err) !== 'retryable') throw err;
      reportUnreachable();
    }
  }

  const cached = await readPartition<T>(spec.kind, spec.profileId);
  return spec.filter ? spec.filter(cached) : cached;
}

// ─── Writes ───────────────────────────────────────────────────────────────────

interface InsertSpec<T> {
  kind: RowKind;
  profileId: string;
  row: T;
  /**
   * Payload fields that may hold a temp id and must be rewritten before send.
   *
   * Declared per call rather than inferred, because only the repository knows
   * which of its fields point at another row. `workoutLogId` does; `exerciseId`
   * names an entry in the static catalogue and must be left alone.
   */
  refs?: string[];
  send: (payload: T & { clientId: string }) => Promise<string>;
}

/**
 * A write that survives the network being gone.
 *
 * Returns the row's id — a real one when it went straight through, a temp one
 * when it went to the queue. The caller cannot tell the difference and does not
 * need to: `finishActiveSession` hands whichever it gets to the sets it writes
 * next, and the flusher rewrites them together when the workout lands.
 */
async function queuedInsert<T extends Record<string, unknown>>(spec: InsertSpec<T>): Promise<string> {
  const clientId = newClientId();
  const tempId = tempIdFor(clientId);

  /**
   * A fresh key on every insert, never one inherited from the row.
   *
   * `linkPendingRoutineToWorkout` re-inserts rows it has just read back, so the
   * entity handed here can arrive carrying the `id` and `clientId` of the row
   * being replaced. Reusing either would make the new row collide with the old
   * one on the unique index — or, if the delete had not flushed yet, resurrect
   * the row that was meant to be gone.
   */
  const { id: _id, clientId: _clientId, ...clean } = spec.row as Record<string, unknown>;
  const payload = { ...clean, clientId } as T & { clientId: string };

  /**
   * Straight to the server, but only when nothing is queued ahead of it.
   *
   * The second half is the ordering invariant. A direct send past a waiting op
   * would let a later write land before an earlier one — which is precisely how
   * `linkPendingRoutineToWorkout`'s delete-then-reinsert would corrupt itself.
   *
   * Keeping the fast path at all is deliberate. Routing everything through the
   * queue is tidier, but it would make `finishActiveSession` return a temp id on
   * the ordinary online path and make its read-back depend on a completed
   * drain — a behaviour change on the most fragile code path in the app, for no
   * gain the user could see.
   */
  if (isOnline() && !(await hasPending())) {
    try {
      const serverId = await spec.send(payload);
      reportReachable();
      await cacheRow(spec.kind, spec.profileId, { ...payload, id: serverId });
      return serverId;
    } catch (err) {
      if (classifyFailure(err) !== 'retryable') throw err;
      reportUnreachable();
    }
  }

  await enqueue({
    kind: spec.kind, op: 'insert', profileId: spec.profileId,
    clientId, tempId, payload, refs: spec.refs,
  });
  // Written to the cache now, not when it lands. That is what puts a workout
  // logged in a basement on the Today screen: reads are just reads, with no
  // overlay of the queue anywhere.
  await cacheRow(spec.kind, spec.profileId, { ...payload, id: tempId });
  void publishSyncState();
  return tempId;
}

interface ByIdSpec {
  kind: RowKind;
  op: 'update' | 'delete' | 'deleteQuery';
  profileId: string;
  targetId: string;
  payload?: Record<string, unknown>;
  send: (targetId: string) => Promise<void>;
  /** The same change, applied to the cache. Runs on both paths. */
  onCache: () => Promise<void>;
}

/** An update or a delete, queued when the network is gone. */
async function queuedById(spec: ByIdSpec): Promise<void> {
  /**
   * A temp id that has since been resolved is a real id.
   *
   * The store can still be holding the old one for the moment between the
   * flush and the id rewrite reaching the screen. Resolving here means a delete
   * in that window addresses the right row instead of being cancelled as a
   * write the server never saw.
   */
  let targetId = spec.targetId;
  if (isTempId(targetId)) {
    targetId = (await lookupId(targetId)) ?? targetId;
  }

  if (!isTempId(targetId) && isOnline() && !(await hasPending())) {
    try {
      await spec.send(targetId);
      reportReachable();
      await spec.onCache();
      return;
    } catch (err) {
      if (classifyFailure(err) !== 'retryable') throw err;
      reportUnreachable();
    }
  }

  await enqueue({
    kind: spec.kind, op: spec.op, profileId: spec.profileId,
    targetId, payload: spec.payload,
  });
  // Applied even when the op annihilated a queued insert: the row is going
  // away locally either way, and that is what the user just asked for.
  await spec.onCache();
  void publishSyncState();
}

// ─── Date helpers, mirroring what the server filters on ──────────────────────

const asDate = (value: unknown): Date => (value instanceof Date ? value : new Date(value as string));

/** The server compares against local midnight-to-midnight; so does this. */
function sameLocalDay(value: unknown, day: Date): boolean {
  const d = asDate(value);
  return d.getFullYear() === day.getFullYear()
    && d.getMonth() === day.getMonth()
    && d.getDate() === day.getDate();
}

function within(value: unknown, start: Date, end: Date): boolean {
  const t = asDate(value).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

// ─── User profiles ────────────────────────────────────────────────────────────

export class OfflineUserProfileRepository implements IUserProfileRepository {
  private readonly inner: IUserProfileRepository;
  constructor(inner: IUserProfileRepository) { this.inner = inner; }

  create(profile: UserProfile): Promise<string> {
    return queuedInsert({
      kind: 'profile', profileId: PROFILE_PARTITION,
      row: profile as unknown as Record<string, unknown>,
      send: p => this.inner.create(p as unknown as UserProfile),
    });
  }

  update(profile: UserProfile): Promise<void> {
    return queuedById({
      kind: 'profile', op: 'update', profileId: PROFILE_PARTITION,
      targetId: profile.id!,
      payload: profile as unknown as Record<string, unknown>,
      send: id => this.inner.update({ ...profile, id }),
      onCache: () => cacheRow('profile', PROFILE_PARTITION, profile as unknown as Record<string, unknown>),
    });
  }

  delete(id: string): Promise<void> {
    return queuedById({
      kind: 'profile', op: 'delete', profileId: PROFILE_PARTITION, targetId: id,
      send: target => this.inner.delete(target),
      onCache: () => evictRow('profile', id),
    });
  }

  /**
   * The read the whole offline boot rests on.
   *
   * `loadProfiles` marks itself loaded even when this throws, and `App.tsx`
   * then reads an empty list as "new user" and opens the sign-up form — a form
   * whose every write fails. So an unreachable API here must produce the cached
   * profiles, not an exception: the gate change alone would land an offline
   * user on onboarding.
   */
  getAll(): Promise<UserProfile[]> {
    return cachedRead({
      kind: 'profile',
      // Profiles are scoped by the session rather than by a profile, so they
      // live in a partition of their own.
      profileId: PROFILE_PARTITION,
      partial: false,
      load: () => this.inner.getAll(),
    });
  }

  /**
   * Answered from `getAll`, never from the inner `get`.
   *
   * `ServerUserProfileRepository.get` catches *everything* and returns
   * undefined, so a dead network is indistinguishable from "no such profile".
   * Wrapping it does not help: there is no error left to catch, so a decorator
   * asking it would see a legitimate-looking undefined and hand that on.
   * `setActiveProfile` reads undefined as nothing to do and returns silently —
   * no profile, no data, no error, and a blank app.
   *
   * Going through `getAll` sidesteps that catch entirely, and is honest in the
   * other direction too: a profile the server has genuinely deleted is missing
   * from the list, so it disappears here rather than being served stale forever.
   * The same reasoning as `getLatest` on measurements.
   */
  async get(id: string): Promise<UserProfile | undefined> {
    const all = await this.getAll();
    return all.find(p => String(p.id) === String(id));
  }
}

// ─── Measurements ─────────────────────────────────────────────────────────────

export class OfflineMeasurementRepository implements IMeasurementRepository {
  private readonly inner: IMeasurementRepository;
  constructor(inner: IMeasurementRepository) { this.inner = inner; }

  save(measurement: Measurement): Promise<string> {
    return queuedInsert({
      kind: 'measurement', profileId: measurement.profileId,
      row: measurement as unknown as Record<string, unknown>,
      send: m => this.inner.save(m as unknown as Measurement),
    });
  }

  delete(id: string): Promise<void> {
    return queuedById({
      kind: 'measurement', op: 'delete', profileId: PROFILE_PARTITION, targetId: id,
      send: target => this.inner.delete(target),
      onCache: () => evictRow('measurement', id),
    });
  }

  getAll(profileId: string): Promise<Measurement[]> {
    return cachedRead({
      kind: 'measurement', profileId, partial: false,
      load: () => this.inner.getAll(profileId),
    });
  }

  /**
   * Rebuilt on this class's own `getAll`, not delegated.
   *
   * `ServerMeasurementRepository.getLatest` calls `this.getAll` — its own, not
   * the decorator's. Delegating would reach straight past the cache to the
   * network and fail offline while `getAll` right next to it succeeded. It is
   * the only method across the nine that self-delegates, which is exactly what
   * makes it easy to miss.
   */
  async getLatest(profileId: string): Promise<Measurement | undefined> {
    const all = await this.getAll(profileId);
    return all.length > 0 ? all[all.length - 1] : undefined;
  }
}

// ─── Food logs ────────────────────────────────────────────────────────────────

export class OfflineFoodLogRepository implements IFoodLogRepository {
  private readonly inner: IFoodLogRepository;
  constructor(inner: IFoodLogRepository) { this.inner = inner; }

  add(log: FoodLog): Promise<string> {
    return queuedInsert({
      kind: 'foodLog', profileId: log.profileId,
      row: log as unknown as Record<string, unknown>,
      send: f => this.inner.add(f as unknown as FoodLog),
    });
  }

  delete(id: string): Promise<void> {
    return queuedById({
      kind: 'foodLog', op: 'delete', profileId: PROFILE_PARTITION, targetId: id,
      send: target => this.inner.delete(target),
      onCache: () => evictRow('foodLog', id),
    });
  }

  getAll(profileId: string, date?: Date): Promise<FoodLog[]> {
    return cachedRead({
      kind: 'foodLog', profileId,
      partial: date !== undefined,
      load: () => this.inner.getAll(profileId, date),
      filter: rows => (date ? rows.filter(r => sameLocalDay(r.timestamp, date)) : rows),
    });
  }
}

// ─── Workout logs ─────────────────────────────────────────────────────────────

export class OfflineWorkoutLogRepository implements IWorkoutLogRepository {
  private readonly inner: IWorkoutLogRepository;
  constructor(inner: IWorkoutLogRepository) { this.inner = inner; }

  add(log: WorkoutLog): Promise<string> {
    return queuedInsert({
      kind: 'workoutLog', profileId: log.profileId,
      row: log as unknown as Record<string, unknown>,
      send: w => this.inner.add(w as unknown as WorkoutLog),
    });
  }

  update(log: WorkoutLog): Promise<void> {
    return queuedById({
      kind: 'workoutLog', op: 'update', profileId: log.profileId,
      targetId: log.id!,
      payload: log as unknown as Record<string, unknown>,
      send: id => this.inner.update({ ...log, id }),
      onCache: () => cacheRow('workoutLog', log.profileId, log as unknown as Record<string, unknown>),
    });
  }

  async delete(id: string): Promise<void> {
    // The profile is not in the signature, so it comes off the cached row —
    // and the sets have to go with it, because the server deletes both in one
    // transaction and a cache that kept them would outlive the session.
    const cached = (await readAllOfKind<WorkoutLog>('workoutLog')).find(l => String(l.id) === String(id));
    const profileId = cached?.profileId ?? PROFILE_PARTITION;

    await queuedById({
      kind: 'workoutLog', op: 'delete', profileId, targetId: id,
      send: target => this.inner.delete(target),
      onCache: async () => {
        await evictRow('workoutLog', id);
        await evictWhere('workoutSet', null, r => String(r.workoutLogId) === String(id));
      },
    });
  }

  getAll(profileId: string, date?: Date): Promise<WorkoutLog[]> {
    return cachedRead({
      kind: 'workoutLog', profileId,
      partial: date !== undefined,
      load: () => this.inner.getAll(profileId, date),
      filter: rows => (date ? rows.filter(r => sameLocalDay(r.timestamp, date)) : rows),
    });
  }

  async getRange(profileId: string, startDate: Date, endDate: Date): Promise<WorkoutLog[]> {
    const rows = await cachedRead({
      kind: 'workoutLog', profileId, partial: true,
      load: () => this.inner.getRange(profileId, startDate, endDate),
      filter: all => all.filter(r => within(r.timestamp, startDate, endDate)),
    });
    // The server's ordering, reproduced. The cache has no other source for it,
    // and `loadWorkoutHistory` renders in the order it is handed.
    return [...rows].sort((a, b) => asDate(b.timestamp).getTime() - asDate(a.timestamp).getTime());
  }
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export class OfflineMessageRepository implements IMessageRepository {
  private readonly inner: IMessageRepository;
  constructor(inner: IMessageRepository) { this.inner = inner; }

  add(message: Message): Promise<string> {
    return queuedInsert({
      kind: 'message', profileId: message.profileId,
      row: message as unknown as Record<string, unknown>,
      send: m => this.inner.add(m as unknown as Message),
    });
  }

  clear(profileId: string): Promise<void> {
    return queuedById({
      kind: 'message', op: 'deleteQuery', profileId, targetId: profileId,
      send: () => this.inner.clear(profileId),
      onCache: () => evictWhere('message', profileId, () => true),
    });
  }

  getAll(profileId: string): Promise<Message[]> {
    return cachedRead({
      kind: 'message', profileId, partial: false,
      load: () => this.inner.getAll(profileId),
    });
  }
}

// ─── Workout sets ─────────────────────────────────────────────────────────────

export class OfflineWorkoutSetRepository implements IWorkoutSetRepository {
  private readonly inner: IWorkoutSetRepository;
  constructor(inner: IWorkoutSetRepository) { this.inner = inner; }

  add(set: WorkoutSet): Promise<string> {
    return queuedInsert({
      kind: 'workoutSet', profileId: set.profileId,
      row: set as unknown as Record<string, unknown>,
      // The one foreign key in this app that can be a temp id. Offline,
      // `finishActiveSession` writes the workout and then N sets pointing at an
      // id that does not exist yet; naming the field here is what tells the
      // flusher to rewrite it once the workout lands.
      refs: ['workoutLogId'],
      send: s => this.inner.add(s as unknown as WorkoutSet),
    });
  }

  async delete(id: string): Promise<void> {
    const cached = (await readAllOfKind<WorkoutSet>('workoutSet')).find(s => String(s.id) === String(id));
    await queuedById({
      kind: 'workoutSet', op: 'delete',
      profileId: cached?.profileId ?? PROFILE_PARTITION, targetId: id,
      send: target => this.inner.delete(target),
      onCache: () => evictRow('workoutSet', id),
    });
  }

  /**
   * Every set of one workout, gone.
   *
   * Addressed by `workoutLogId`, which is a route parameter rather than a row
   * id — including the literal `'pending'` that `linkPendingRoutineToWorkout`
   * files un-linked routine sets under. `isTempId('pending')` is false, so it
   * is passed through verbatim exactly as today.
   */
  async deleteForWorkout(workoutLogId: string): Promise<void> {
    const cached = (await readAllOfKind<WorkoutSet>('workoutSet'))
      .find(s => String(s.workoutLogId) === String(workoutLogId));

    await queuedById({
      kind: 'workoutSet', op: 'deleteQuery',
      profileId: cached?.profileId ?? PROFILE_PARTITION, targetId: workoutLogId,
      send: target => this.inner.deleteForWorkout(target),
      onCache: () => evictWhere('workoutSet', null, r => String(r.workoutLogId) === String(workoutLogId)),
    });
  }

  /**
   * Every set the profile has logged — and the only set read allowed to replace
   * its partition, because it is the only one that asks for everything.
   */
  getAllForProfile(profileId: string): Promise<WorkoutSet[]> {
    return cachedRead({
      kind: 'workoutSet', profileId, partial: false,
      load: () => this.inner.getAllForProfile(profileId),
    });
  }

  getForExercise(profileId: string, exerciseName: string): Promise<WorkoutSet[]> {
    return cachedRead({
      kind: 'workoutSet', profileId, partial: true,
      load: () => this.inner.getForExercise(profileId, exerciseName),
      // The server compares case-insensitively (`LOWER(...) = LOWER(...)`).
      filter: rows => rows.filter(r =>
        r.exerciseName?.toLowerCase() === exerciseName.toLowerCase()),
    });
  }

  /**
   * The sets of one workout.
   *
   * No `profileId` in the signature, so the cache falls back to a scan of the
   * one kind. Also the read that answers `getForWorkout('pending')` — the
   * literal id un-linked routine sets are filed under — which is why every set
   * read shares a single partition rather than being split by workout.
   */
  async getForWorkout(workoutLogId: string): Promise<WorkoutSet[]> {
    if (isOnline()) {
      try {
        const rows = await this.inner.getForWorkout(workoutLogId);
        reportReachable();
        // Merged, never replaced: these are one workout's sets, and the
        // partition holds every workout's.
        const profileId = rows[0]?.profileId;
        if (profileId) {
          await cacheRows('workoutSet', profileId, rows as unknown as Record<string, unknown>[], 'merge');
        }
        return rows;
      } catch (err) {
        if (classifyFailure(err) !== 'retryable') throw err;
        reportUnreachable();
      }
    }

    const cached = await readAllOfKind<WorkoutSet>('workoutSet');
    return cached
      .filter(s => String(s.workoutLogId) === String(workoutLogId))
      .sort((a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0));
  }
}

// ─── Favourites ───────────────────────────────────────────────────────────────

export class OfflineFavoriteExerciseRepository implements IFavoriteExerciseRepository {
  private readonly inner: IFavoriteExerciseRepository;
  constructor(inner: IFavoriteExerciseRepository) { this.inner = inner; }

  add(favorite: FavoriteExercise): Promise<string> {
    return queuedInsert({
      kind: 'favorite', profileId: favorite.profileId,
      row: favorite as unknown as Record<string, unknown>,
      send: f => this.inner.add(f as unknown as FavoriteExercise),
    });
  }

  remove(profileId: string, exerciseId: string): Promise<void> {
    return queuedById({
      kind: 'favorite', op: 'delete', profileId,
      // The pair is the identity here — the endpoint takes both and no row id.
      targetId: exerciseId,
      payload: { profileId, exerciseId },
      send: () => this.inner.remove(profileId, exerciseId),
      onCache: () => evictWhere('favorite', profileId, r => String(r.exerciseId) === String(exerciseId)),
    });
  }

  getAll(profileId: string): Promise<FavoriteExercise[]> {
    return cachedRead({
      kind: 'favorite', profileId, partial: false,
      load: () => this.inner.getAll(profileId),
    });
  }
}

// ─── Routines ─────────────────────────────────────────────────────────────────

export class OfflineRoutineTemplateRepository implements IRoutineTemplateRepository {
  private readonly inner: IRoutineTemplateRepository;
  constructor(inner: IRoutineTemplateRepository) { this.inner = inner; }

  save(routine: RoutineTemplate): Promise<string> {
    return queuedInsert({
      kind: 'routine', profileId: routine.profileId,
      row: routine as unknown as Record<string, unknown>,
      send: r => this.inner.save(r as unknown as RoutineTemplate),
    });
  }

  async delete(id: string): Promise<void> {
    const cached = (await readAllOfKind<RoutineTemplate>('routine')).find(r => String(r.id) === String(id));
    await queuedById({
      kind: 'routine', op: 'delete',
      profileId: cached?.profileId ?? PROFILE_PARTITION, targetId: id,
      send: target => this.inner.delete(target),
      onCache: () => evictRow('routine', id),
    });
  }

  getAll(profileId: string): Promise<RoutineTemplate[]> {
    return cachedRead({
      kind: 'routine', profileId, partial: false,
      load: () => this.inner.getAll(profileId),
    });
  }

  /**
   * One routine by id, with no profile in the signature to scope the fallback.
   *
   * A scan of the kind rather than a partition read — the same shape as
   * `getForWorkout`, and for the same reason.
   */
  async get(id: string): Promise<RoutineTemplate | undefined> {
    if (isOnline()) {
      try {
        const row = await this.inner.get(id);
        reportReachable();
        if (row?.profileId) {
          await cacheRows('routine', row.profileId, [row as unknown as Record<string, unknown>], 'merge');
        }
        return row;
      } catch (err) {
        if (classifyFailure(err) !== 'retryable') throw err;
        reportUnreachable();
      }
    }

    const cached = await readAllOfKind<RoutineTemplate>('routine');
    return cached.find(r => String(r.id) === String(id));
  }
}

// ─── Wellness ─────────────────────────────────────────────────────────────────

export class OfflineWellnessLogRepository implements IWellnessLogRepository {
  private readonly inner: IWellnessLogRepository;
  constructor(inner: IWellnessLogRepository) { this.inner = inner; }

  /**
   * The day, written or corrected.
   *
   * Queued as an insert even though it is an upsert, because that is what it is
   * on the wire: a `PUT` keyed by `(profileId, day)`. It needs no `clientId` to
   * be safe — the server's `UNIQUE(profileId, day)` already makes a replay
   * idempotent — but it goes through the same path so the coalescing rule for
   * repeated days has somewhere to live.
   */
  save(log: WellnessLog): Promise<string> {
    return queuedInsert({
      kind: 'wellness', profileId: log.profileId,
      row: log as unknown as Record<string, unknown>,
      send: w => this.inner.save(w as unknown as WellnessLog),
    });
  }

  async delete(id: string): Promise<void> {
    const cached = (await readAllOfKind<WellnessLog>('wellness')).find(w => String(w.id) === String(id));
    await queuedById({
      kind: 'wellness', op: 'delete',
      profileId: cached?.profileId ?? PROFILE_PARTITION, targetId: id,
      send: target => this.inner.delete(target),
      onCache: () => evictRow('wellness', id),
    });
  }

  /**
   * Always `partial`, because `getRange` is always a window.
   *
   * `WELLNESS_WINDOW_DAYS` bounds every wellness read the app makes, so a
   * `replace` here would delete days older than the window — days a wider
   * window would later want back, and which nothing would refetch.
   */
  getRange(profileId: string, sinceDay: string): Promise<WellnessLog[]> {
    return cachedRead({
      kind: 'wellness', profileId, partial: true,
      load: () => this.inner.getRange(profileId, sinceDay),
      // Days are ISO `YYYY-MM-DD`, so a string compare is a date compare.
      filter: rows => rows.filter(r => r.day >= sinceDay).sort((a, b) => a.day.localeCompare(b.day)),
    });
  }

  async getForDay(profileId: string, day: string): Promise<WellnessLog | undefined> {
    if (isOnline()) {
      try {
        const row = await this.inner.getForDay(profileId, day);
        reportReachable();
        if (row) await cacheRows('wellness', profileId, [row as unknown as Record<string, unknown>], 'merge');
        return row;
      } catch (err) {
        if (classifyFailure(err) !== 'retryable') throw err;
        reportUnreachable();
      }
    }

    const cached = await readPartition<WellnessLog>('wellness', profileId);
    return cached.find(r => r.day === day);
  }
}

/**
 * Puts a queued op back on the wire.
 *
 * The inverse of the decorators above: they turn a repository call into an op,
 * this turns an op back into a repository call — on the *inner* repositories,
 * so a replay cannot be re-queued by the wrapper it came from.
 *
 * Explicit rather than reflective. A table of `kind` and `op` to a method is
 * more typing than dispatching by name, and it is also the thing that fails to
 * compile when a repository grows a method, rather than failing at 3am on a
 * phone with an op nothing knows how to send.
 */
function makeSender(inner: RepositoryBundle) {
  return async (op: OutboxOp): Promise<string | void> => {
    const body = (op.payload ?? {}) as never;
    const id = op.targetId!;

    switch (op.kind) {
      case 'profile':
        if (op.op === 'insert') return inner.profile.create(body);
        if (op.op === 'update') return inner.profile.update({ ...(op.payload as object), id } as UserProfile);
        return inner.profile.delete(id);

      case 'measurement':
        if (op.op === 'insert') return inner.measurement.save(body);
        return inner.measurement.delete(id);

      case 'foodLog':
        if (op.op === 'insert') return inner.food.add(body);
        return inner.food.delete(id);

      case 'workoutLog':
        if (op.op === 'insert') return inner.workout.add(body);
        if (op.op === 'update') return inner.workout.update({ ...(op.payload as object), id } as WorkoutLog);
        return inner.workout.delete(id);

      case 'message':
        if (op.op === 'insert') return inner.message.add(body);
        return inner.message.clear(op.profileId);

      case 'workoutSet':
        if (op.op === 'insert') return inner.workoutSet.add(body);
        if (op.op === 'deleteQuery') return inner.workoutSet.deleteForWorkout(id);
        return inner.workoutSet.delete(id);

      case 'favorite':
        if (op.op === 'insert') return inner.favorite.add(body);
        return inner.favorite.remove(op.profileId, String(op.payload?.exerciseId ?? id));

      case 'routine':
        if (op.op === 'insert') return inner.routine.save(body);
        return inner.routine.delete(id);

      case 'wellness':
        if (op.op === 'insert') return inner.wellness.save(body);
        return inner.wellness.delete(id);
    }
  };
}

/**
 * Wraps a bundle of server repositories.
 *
 * One call so `store.ts` gains a wrapper rather than nine, and so the set can
 * never be decorated halfway — a repository left bare would read straight past
 * the cache and fail offline while the eight around it worked.
 */
export function decorateRepositories(inner: RepositoryBundle): RepositoryBundle {
  // The flusher sends through the inner repositories, never the wrappers —
  // otherwise a replay would be re-queued by the very layer replaying it.
  configureFlusher(makeSender(inner));

  return {
    profile: new OfflineUserProfileRepository(inner.profile),
    measurement: new OfflineMeasurementRepository(inner.measurement),
    food: new OfflineFoodLogRepository(inner.food),
    workout: new OfflineWorkoutLogRepository(inner.workout),
    message: new OfflineMessageRepository(inner.message),
    workoutSet: new OfflineWorkoutSetRepository(inner.workoutSet),
    favorite: new OfflineFavoriteExerciseRepository(inner.favorite),
    routine: new OfflineRoutineTemplateRepository(inner.routine),
    wellness: new OfflineWellnessLogRepository(inner.wellness),
  };
}
