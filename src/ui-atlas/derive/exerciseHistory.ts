import type { WorkoutSet } from '../../core/entities/WorkoutSet';
import { isCountedSet } from './muscleLoad';
import { e1rm, isPrEligible, normalizeName } from './records';

/**
 * What you did on one exercise, session by session.
 *
 * The app could already tell you your all-time best on a lift and what you did
 * on the single most recent session (through `getExerciseStats`), but not the
 * shape of the progression — whether 80×8 was a step up or a step back, and how
 * long you have been sitting on it. Answering that needs every session, not an
 * aggregate.
 */

export interface HistorySetVM {
  setNum: number;
  weightKg: number;
  reps: number;
  /** True when this set was a record at the time it was logged. */
  isPr: boolean;
}

export interface ExerciseSessionVM {
  workoutLogId: string;
  at: Date;
  sets: HistorySetVM[];
  volumeKg: number;
  /** Heaviest set of that session — the one line worth reading if you read one. */
  topSet: { weightKg: number; reps: number } | null;
  /** Best estimated 1RM of the session, for comparing sessions of different rep ranges. */
  bestE1rm: number;
}

/**
 * Sessions for `exerciseName`, newest first.
 *
 * PR flags are computed by walking forward with a running best, the same rule
 * `annotatePrs` uses: asking "is this a record by today's standard" would strip
 * the badge off every past session the moment you got stronger.
 */
export function buildExerciseHistory(
  sets: WorkoutSet[],
  exerciseName: string,
  limit = 12,
): ExerciseSessionVM[] {
  const key = normalizeName(exerciseName);
  if (!key) return [];

  const mine = sets
    .filter(s => isCountedSet(s) && normalizeName(s.exerciseName) === key)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const byLog = new Map<string, WorkoutSet[]>();
  for (const set of mine) {
    const id = set.workoutLogId || new Date(set.timestamp).toDateString();
    byLog.set(id, [...(byLog.get(id) ?? []), set]);
  }

  let runningBest = 0;
  const sessions: ExerciseSessionVM[] = [];

  // Chronological while flagging records, reversed at the end for display.
  for (const [workoutLogId, group] of byLog) {
    const ordered = [...group].sort((a, b) => a.setNumber - b.setNumber);

    let volumeKg = 0;
    let bestE1rm = 0;
    let topSet: { weightKg: number; reps: number } | null = null;

    const rows: HistorySetVM[] = ordered.map(set => {
      const weightKg = set.weight ?? 0;
      const reps = set.reps ?? 0;
      volumeKg += weightKg * reps;
      if (!topSet || weightKg > topSet.weightKg) topSet = { weightKg, reps };

      let isPr = false;
      if (isPrEligible(set)) {
        const score = e1rm(weightKg, reps);
        if (score > bestE1rm) bestE1rm = score;
        // The very first scoreable set of an exercise is a baseline, not a record.
        if (runningBest > 0 && score > runningBest) isPr = true;
        if (score > runningBest) runningBest = score;
      }

      return { setNum: set.setNumber, weightKg, reps, isPr };
    });

    sessions.push({
      workoutLogId,
      at: new Date(ordered[0].timestamp),
      sets: rows,
      volumeKg: Math.round(volumeKg),
      topSet,
      bestE1rm: +bestE1rm.toFixed(1),
    });
  }

  return sessions.reverse().slice(0, limit);
}
