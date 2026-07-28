import type { WorkoutSet } from '../../core/entities/WorkoutSet';
import type { PrRecordVM } from '../types';
import { isCountedSet } from './muscleLoad';

/**
 * Epley. Chosen over Brzycki because it stays monotonic across the whole rep
 * range — Brzycki degenerates above ~10 reps — and because it is the convention
 * in comparable training apps, so numbers are comparable to what users see elsewhere.
 */
export function e1rm(weightKg: number, reps: number): number {
  if (!(weightKg > 0) || !(reps > 0)) return 0;
  if (reps <= 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/** Above this, e1RM stops predicting anything useful, so those sets never set a PR. */
export const E1RM_MAX_REPS = 12;

/** Names come from three sources (catalogue, coach, hand-typed) and must key consistently. */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isPrEligible(set: WorkoutSet): boolean {
  return (
    isCountedSet(set) &&
    (set.weight ?? 0) > 0 &&
    (set.reps ?? 0) > 0 &&
    (set.reps ?? 0) <= E1RM_MAX_REPS
  );
}

export interface ExerciseUsage {
  name: string;
  exerciseId?: string;
  lastAt: Date;
  bestKg: number;
  bestE1rm: number;
  bestReps: number;
  bestAt: Date;
  sessions: number;
}

export type ExerciseUsageMap = Map<string, ExerciseUsage>;

/**
 * One pass over history, keyed by normalized exercise name.
 *
 * Name rather than `exerciseId` because that field is optional and much of the
 * existing history predates it. This single map feeds catalogue `lastUsedAt` and
 * `bestKg`, the personal-records list, and the live session's PR flags.
 */
export function buildExerciseUsage(sets: WorkoutSet[]): ExerciseUsageMap {
  const usage: ExerciseUsageMap = new Map();
  const sessionsByName = new Map<string, Set<string>>();

  for (const set of sets) {
    if (!isCountedSet(set)) continue;
    const key = normalizeName(set.exerciseName);
    if (!key) continue;

    const at = new Date(set.timestamp);
    const weight = set.weight ?? 0;
    const reps = set.reps ?? 0;
    const score = isPrEligible(set) ? e1rm(weight, reps) : 0;

    const seen = sessionsByName.get(key) ?? new Set<string>();
    seen.add(set.workoutLogId);
    sessionsByName.set(key, seen);

    const existing = usage.get(key);
    if (!existing) {
      usage.set(key, {
        name: set.exerciseName.trim(),
        exerciseId: set.exerciseId,
        lastAt: at,
        bestKg: weight,
        bestE1rm: score,
        bestReps: reps,
        bestAt: at,
        sessions: 0,
      });
      continue;
    }

    if (at > existing.lastAt) existing.lastAt = at;
    if (weight > existing.bestKg) existing.bestKg = weight;
    if (score > existing.bestE1rm) {
      existing.bestE1rm = score;
      existing.bestReps = reps;
      existing.bestAt = at;
      existing.bestKg = Math.max(existing.bestKg, weight);
    }
    // Backfill the id if any set ever carried one.
    if (!existing.exerciseId && set.exerciseId) existing.exerciseId = set.exerciseId;
  }

  for (const [key, entry] of usage) entry.sessions = sessionsByName.get(key)?.size ?? 0;
  return usage;
}

/** Best e1RM per exercise, strongest first. */
export function buildPersonalRecords(sets: WorkoutSet[], limit = 8): PrRecordVM[] {
  const records: PrRecordVM[] = [];

  for (const entry of buildExerciseUsage(sets).values()) {
    if (entry.bestE1rm <= 0) continue;
    records.push({
      exerciseName: entry.name,
      exerciseId: entry.exerciseId,
      weightKg: entry.bestKg,
      reps: entry.bestReps,
      e1rm: +entry.bestE1rm.toFixed(1),
      at: entry.bestAt,
    });
  }

  return records.sort((a, b) => b.e1rm - a.e1rm).slice(0, limit);
}

/**
 * Ids of sets that were a personal record **at the time they were logged**.
 *
 * Walking chronologically with a running best matters: asking "is this a PR by
 * today's standard" would retroactively strip the PR badge off every historical
 * session the moment you got stronger.
 */
export function annotatePrs(sets: WorkoutSet[]): Set<string> {
  const chronological = [...sets].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const best = new Map<string, number>();
  const prSetIds = new Set<string>();

  for (const set of chronological) {
    if (!isPrEligible(set)) continue;
    const key = normalizeName(set.exerciseName);
    const score = e1rm(set.weight ?? 0, set.reps ?? 0);
    const previous = best.get(key);

    // The first ever set of an exercise is a baseline, not a record.
    if (previous !== undefined && score > previous && set.id) prSetIds.add(set.id);
    if (previous === undefined || score > previous) best.set(key, score);
  }

  return prSetIds;
}

/** Best e1RM per exercise strictly before `before` — the baseline a live set has to beat. */
export function bestBefore(sets: WorkoutSet[], before: Date): Map<string, number> {
  const best = new Map<string, number>();
  for (const set of sets) {
    if (!isPrEligible(set)) continue;
    if (new Date(set.timestamp) >= before) continue;
    const key = normalizeName(set.exerciseName);
    const score = e1rm(set.weight ?? 0, set.reps ?? 0);
    if (score > (best.get(key) ?? 0)) best.set(key, score);
  }
  return best;
}
