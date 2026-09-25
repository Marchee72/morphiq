import type { WorkoutSet } from '../../core/entities/WorkoutSet';
import type { Exercise } from '../../core/entities/Exercise';
import type { RoutineExerciseItem, RoutineTemplate } from '../../core/entities/RoutineTemplate';
import type { MuscleGroupId } from '../types';
import type { StaticKey } from '../../i18n/types';
import { hoursBetween } from './buckets';
import { MUSCLE_GROUP_LABELS, RECOVERY_HOURS, isCountedSet, resolveGroup } from './muscleLoad';

/** Groups a suggestion names, and exercises it lists per group. */
const GROUPS = 2;
const PER_GROUP = 2;

export interface SuggestedExercise {
  name: string;
  exerciseId?: string;
  group: MuscleGroupId;
  /** How the last session did it: sets, and the reps of its last set. */
  sets: number;
  reps: number;
}

export interface TrainSuggestionVM {
  groups: { group: MuscleGroupId; labelKey: StaticKey; daysSince: number }[];
  exercises: SuggestedExercise[];
  /** The saved routine that covers these groups best, if one covers them at all. */
  routine: RoutineTemplate | null;
  /** How many different suggestions there are to rotate through. */
  options: number;
}

interface GroupHistory {
  lastAt: Date;
  /** By exercise, most recently done first. */
  exercises: Map<string, { name: string; exerciseId?: string; lastAt: Date; lastLog: string; sets: number; reps: number }>;
}

/**
 * Every group's last session and the lifts it was trained with, over all the
 * sets there are — not the week `buildMuscleLoad` counts, because "nine days
 * since back" is exactly what a week-long window cannot see.
 */
export function buildGroupHistory(
  sets: WorkoutSet[],
  resolveExercise: (set: WorkoutSet) => Exercise | undefined,
): Map<MuscleGroupId, GroupHistory> {
  const byGroup = new Map<MuscleGroupId, GroupHistory>();
  for (const set of sets) {
    if (!isCountedSet(set)) continue;
    const group = resolveGroup(set, resolveExercise(set));
    if (!group) continue;
    const at = new Date(set.timestamp);
    const entry = byGroup.get(group) ?? { lastAt: at, exercises: new Map() };
    if (at > entry.lastAt) entry.lastAt = at;

    const key = set.exerciseName.trim().toLowerCase();
    const ex = entry.exercises.get(key);
    if (!ex || at > ex.lastAt) {
      // A newer session of this lift starts its count again.
      const sameLog = ex?.lastLog === set.workoutLogId;
      entry.exercises.set(key, {
        name: set.exerciseName.trim(),
        exerciseId: set.exerciseId ?? ex?.exerciseId,
        lastAt: at,
        lastLog: set.workoutLogId,
        sets: sameLog ? ex!.sets + 1 : 1,
        reps: set.reps ?? 0,
      });
    } else if (ex.lastLog === set.workoutLogId) {
      // Same session: one more set, and its reps are the latest word.
      ex.sets++;
      ex.reps = set.reps ?? ex.reps;
    }
    byGroup.set(group, entry);
  }
  return byGroup;
}

/**
 * What to train today: the groups rested longest that are past their recovery
 * window, with the lifts you last trained them with, as you did them.
 *
 * Only groups you have trained before: a group you never train is not "due",
 * and suggesting forearms to someone who has never done a wrist curl is noise.
 * `offset` rotates through the candidates in pairs, for "another suggestion".
 */
export function suggestTraining(
  history: Map<MuscleGroupId, GroupHistory>,
  routines: RoutineTemplate[],
  groupOf: (item: RoutineExerciseItem) => MuscleGroupId | null,
  now: Date,
  offset = 0,
): TrainSuggestionVM | null {
  const candidates = [...history.entries()]
    .filter(([group, entry]) => hoursBetween(entry.lastAt, now) >= RECOVERY_HOURS[group])
    .sort((a, b) => a[1].lastAt.getTime() - b[1].lastAt.getTime());
  if (candidates.length === 0) return null;

  const options = Math.max(1, Math.ceil(candidates.length / GROUPS));
  const start = (((offset % options) + options) % options) * GROUPS;
  const picked = candidates.slice(start, start + GROUPS);

  const exercises = picked.flatMap(([group, entry]) => [...entry.exercises.values()]
    .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime())
    .slice(0, PER_GROUP)
    .map(ex => ({ name: ex.name, exerciseId: ex.exerciseId, group, sets: Math.max(1, ex.sets), reps: ex.reps })));

  const wanted = new Set(picked.map(([group]) => group));
  let routine: RoutineTemplate | null = null;
  let best = 0;
  for (const candidate of routines) {
    const hits = candidate.exercises.filter(item => {
      const group = groupOf(item);
      return group !== null && wanted.has(group);
    }).length;
    // Most of the routine has to be about these groups, not one lift in passing.
    if (hits > best && hits * 2 >= candidate.exercises.length) {
      best = hits;
      routine = candidate;
    }
  }

  return {
    groups: picked.map(([group, entry]) => ({
      group,
      labelKey: MUSCLE_GROUP_LABELS[group],
      daysSince: Math.floor(hoursBetween(entry.lastAt, now) / 24),
    })),
    exercises,
    routine,
    options,
  };
}
