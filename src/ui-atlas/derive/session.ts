import type { Exercise } from '../../core/entities/Exercise';
import type { WorkoutSet } from '../../core/entities/WorkoutSet';
import type {
  ExerciseBestVM, SessionCursor, SessionExerciseVM, SessionSetVM, SessionTotalsVM,
} from '../types';
import { e1rm, isPrEligible, normalizeName, type ExerciseUsageMap } from './records';

/** Sets as they exist mid-session, before a workout log has been written. */
export type DraftSet = Omit<WorkoutSet, 'profileId' | 'timestamp' | 'workoutLogId'>;

export interface SessionExerciseInput {
  id: string;
  exerciseId?: string;
  exerciseName: string;
  targetSets: number;
  targetReps?: number;
  notes?: string;
  biserieGroupId?: string;
}

/** Historical anchors for one exercise, as the store's `getExerciseStats` returns them. */
export interface ExerciseAnchors {
  lastSets?: { weight: number; reps: number }[];
  lastMaxWeight?: number;
  prWeight?: number;
  prReps?: number;
}

export const DEFAULT_REST_SEC = 90;

/**
 * Rest scales with how systemically taxing the lift is. These match what the
 * live workout screen has always defaulted to for the general case (90 s) while
 * giving heavy compounds and isolation work more appropriate windows.
 */
export const REST_BY_EQUIPMENT: Record<string, number> = {
  barbell: 150,
  'olympic barbell': 150,
  'trap bar': 150,
  'ez barbell': 120,
  'smith machine': 120,
  dumbbell: 90,
  kettlebell: 90,
  'leverage machine': 75,
  cable: 75,
  'sled machine': 90,
  'body weight': 60,
  assisted: 60,
  band: 60,
  'resistance band': 60,
};

export function restSecFor(exercise: Exercise | undefined): number {
  if (!exercise) return DEFAULT_REST_SEC;
  return REST_BY_EQUIPMENT[exercise.equipment?.toLowerCase()] ?? DEFAULT_REST_SEC;
}

function anchorFor(anchors: ExerciseAnchors | null, setIdx: number): { lastWeightKg?: number; lastReps?: number } {
  if (!anchors) return {};
  const fromLastSession = anchors.lastSets?.[setIdx];
  if (fromLastSession) return { lastWeightKg: fromLastSession.weight, lastReps: fromLastSession.reps };
  // Past the end of last session's set list, fall back to its top set.
  if (anchors.lastMaxWeight) return { lastWeightKg: anchors.lastMaxWeight, lastReps: anchors.prReps };
  return {};
}

/**
 * Merges the planned exercise list with the sets actually logged so far.
 *
 * Freestyle sessions carry no `routineExercises`, so the exercise list is
 * recovered from the logged sets in first-logged order.
 */
/**
 * The all-time best on one exercise, for the Train screen's info strip.
 *
 * Reads the same usage map the catalogue and the records list are built from, so
 * "your PR" mid-session is the number the rest of the app would show — deriving
 * it separately here is how those two drift apart.
 */
function bestFor(usage: ExerciseUsageMap, key: string): ExerciseBestVM | null {
  const entry = usage.get(key);
  if (!entry || entry.bestE1rm <= 0) return null;
  return {
    weightKg: entry.bestKg,
    reps: entry.bestReps,
    e1rm: +entry.bestE1rm.toFixed(1),
    at: entry.bestAt,
  };
}

export function buildSessionExercises(
  planned: SessionExerciseInput[] | undefined,
  sets: DraftSet[],
  resolveExercise: (input: { exerciseId?: string; exerciseName: string }) => Exercise | undefined,
  anchorsFor: (exerciseName: string) => ExerciseAnchors | null,
  bestBeforeSession: Map<string, number> = new Map(),
  usage: ExerciseUsageMap = new Map(),
): SessionExerciseVM[] {
  const setsByName = new Map<string, DraftSet[]>();
  for (const set of sets) {
    const key = normalizeName(set.exerciseName);
    setsByName.set(key, [...(setsByName.get(key) ?? []), set]);
  }

  const entries: SessionExerciseInput[] = planned?.length
    ? planned
    : [...setsByName.values()].map((group, i) => ({
        id: `freestyle-${i}`,
        exerciseId: group[0].exerciseId,
        exerciseName: group[0].exerciseName,
        targetSets: group.length,
      }));

  return entries.map(entry => {
    const key = normalizeName(entry.exerciseName);
    const logged = (setsByName.get(key) ?? []).sort((a, b) => a.setNumber - b.setNumber);
    const exercise = resolveExercise(entry);
    const anchors = anchorsFor(entry.exerciseName);
    const previousBest = bestBeforeSession.get(key) ?? 0;

    const count = Math.max(entry.targetSets || 0, logged.length);
    const sets: SessionSetVM[] = Array.from({ length: count }, (_, i) => {
      const actual = logged[i];
      const weightKg = actual?.weight ?? 0;
      const reps = actual?.reps ?? entry.targetReps ?? 0;
      const done = Boolean(actual?.isCompleted);

      return {
        setNum: i + 1,
        weightKg,
        reps,
        done,
        ...anchorFor(anchors, i),
        isPr:
          done && actual && isPrEligible(actual as WorkoutSet) && previousBest > 0
            ? e1rm(weightKg, reps) > previousBest
            : false,
      };
    });

    return {
      key: entry.id,
      exerciseId: entry.exerciseId ?? exercise?.id,
      name: entry.exerciseName,
      target: exercise?.target ?? '',
      equipment: exercise?.equipment ?? '',
      image: exercise?.image ?? '',
      gif: exercise?.gifUrl ?? '',
      sets,
      restSec: restSecFor(exercise),
      note: entry.notes,
      best: bestFor(usage, key),
    };
  });
}

export function buildSessionTotals(exercises: SessionExerciseVM[]): SessionTotalsVM {
  let volumeKg = 0;
  let setsDone = 0;
  let setsPlanned = 0;
  let prs = 0;

  for (const exercise of exercises) {
    setsPlanned += exercise.sets.length;
    for (const set of exercise.sets) {
      if (!set.done) continue;
      setsDone++;
      volumeKg += set.weightKg * set.reps;
      if (set.isPr) prs++;
    }
  }

  return { volumeKg: Math.round(volumeKg), setsDone, setsPlanned, prs };
}

/**
 * The first set not yet completed — what both Train screens open on.
 * Replaces the showcase's hardcoded `sessionExercises[1]` / `useState(2)`.
 */
export function findCursor(exercises: SessionExerciseVM[]): SessionCursor {
  for (let e = 0; e < exercises.length; e++) {
    const s = exercises[e].sets.findIndex(set => !set.done);
    if (s !== -1) return { exerciseIdx: e, setIdx: s };
  }
  // Everything is done: park on the last set rather than out of bounds.
  const last = Math.max(0, exercises.length - 1);
  return { exerciseIdx: last, setIdx: Math.max(0, (exercises[last]?.sets.length ?? 1) - 1) };
}
