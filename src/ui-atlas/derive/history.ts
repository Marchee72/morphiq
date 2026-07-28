import type { WorkoutLog } from '../../core/entities/WorkoutLog';
import type { WorkoutSet } from '../../core/entities/WorkoutSet';
import type { FeelingId, HistoryEntryVM } from '../types';
import { isCountedSet } from './muscleLoad';
import { weeklyBuckets } from './buckets';

export function setVolume(set: WorkoutSet): number {
  if (!isCountedSet(set)) return 0;
  return (set.weight ?? 0) * (set.reps ?? 0);
}

export function totalVolume(sets: WorkoutSet[]): number {
  return Math.round(sets.reduce((total, set) => total + setVolume(set), 0));
}

/**
 * Past sessions, newest first.
 *
 * `prSetIds` comes from `annotatePrs`, which walks chronologically — so a session
 * keeps the PR badge it earned at the time rather than losing it the moment a
 * later session beats it.
 */
export function buildHistory(
  logs: WorkoutLog[],
  setsByLog: Record<string, WorkoutSet[]>,
  prSetIds: Set<string> = new Set(),
): HistoryEntryVM[] {
  return [...logs]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .map(log => {
      const id = log.id ?? '';
      const sets = setsByLog[id] ?? [];
      const counted = sets.filter(isCountedSet);

      return {
        id,
        at: new Date(log.timestamp),
        title: log.type,
        durationMin: log.duration ?? 0,
        volumeKg: totalVolume(counted),
        sets: counted.length,
        feeling: log.feelingTag as FeelingId | undefined,
        prs: counted.filter(s => s.id && prSetIds.has(s.id)).length,
      };
    });
}

/** Weekly training tonnage, oldest → newest. Zero-filled, since a rest week is real information. */
export function buildWeeklyVolume(
  logs: WorkoutLog[],
  setsByLog: Record<string, WorkoutSet[]>,
  now: Date,
  weeks = 12,
): number[] {
  return weeklyBuckets(logs, log => new Date(log.timestamp), now, weeks).map(bucket =>
    bucket.items.reduce((total, log) => total + totalVolume(setsByLog[log.id ?? ''] ?? []), 0),
  );
}

export interface WeeklyStatsVM {
  workouts: number;
  minutes: number;
  calories: number;
  volumeKg: number;
}

/** The Gym-hub tiles: what the last seven days actually contained. */
export function buildWeeklyStats(
  logs: WorkoutLog[],
  setsByLog: Record<string, WorkoutSet[]>,
  now: Date,
): WeeklyStatsVM {
  const since = now.getTime() - 7 * 86_400_000;
  const recent = logs.filter(log => new Date(log.timestamp).getTime() >= since);

  return {
    workouts: recent.length,
    minutes: recent.reduce((total, log) => total + (log.duration ?? 0), 0),
    calories: Math.round(recent.reduce((total, log) => total + (log.caloriesBurned ?? 0), 0)),
    volumeKg: recent.reduce((total, log) => total + totalVolume(setsByLog[log.id ?? ''] ?? []), 0),
  };
}
