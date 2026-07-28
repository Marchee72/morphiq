import type { FeelingId, SessionExerciseVM, SessionTotalsVM, SessionVM } from '../types';

/**
 * What a session was, captured the moment it ends.
 *
 * This has to be built *before* `finishActiveSession` runs: that call sets
 * `activeSession` to null, and every number below is derived from it. Snapshot,
 * then write, then show — any other order renders an empty summary.
 *
 * Like the rest of the view models it holds real values, never formatted strings
 * — the summary screen formats through `useT().fmt` at the render edge.
 */

export interface SummaryExerciseVM {
  key: string;
  /** Kept so the session can be saved back as a routine. */
  exerciseId?: string;
  name: string;
  image: string;
  setsDone: number;
  setsPlanned: number;
  volumeKg: number;
  /** The heaviest completed set, which is the one worth reading back. */
  topSet: { weightKg: number; reps: number } | null;
  prCount: number;
}

export interface SummaryPrVM {
  exerciseName: string;
  weightKg: number;
  reps: number;
}

export interface SessionSummaryVM {
  title: string;
  startedAt: Date;
  endedAt: Date;
  durationSec: number;
  volumeKg: number;
  setsDone: number;
  setsPlanned: number;
  exercisesDone: number;
  exercises: SummaryExerciseVM[];
  prs: SummaryPrVM[];
  feeling?: FeelingId;
  notes?: string;
}

export function buildSessionSummary(
  session: SessionVM,
  exercises: SessionExerciseVM[],
  totals: SessionTotalsVM,
  endedAt: Date,
): SessionSummaryVM {
  const prs: SummaryPrVM[] = [];

  const rows: SummaryExerciseVM[] = exercises.map(exercise => {
    let volumeKg = 0;
    let setsDone = 0;
    let prCount = 0;
    let topSet: { weightKg: number; reps: number } | null = null;

    for (const set of exercise.sets) {
      if (!set.done) continue;
      setsDone++;
      volumeKg += set.weightKg * set.reps;
      if (!topSet || set.weightKg > topSet.weightKg) {
        topSet = { weightKg: set.weightKg, reps: set.reps };
      }
      if (set.isPr) {
        prCount++;
        prs.push({ exerciseName: exercise.name, weightKg: set.weightKg, reps: set.reps });
      }
    }

    return {
      key: exercise.key,
      exerciseId: exercise.exerciseId,
      name: exercise.name,
      image: exercise.image,
      setsDone,
      setsPlanned: exercise.sets.length,
      volumeKg: Math.round(volumeKg),
      topSet,
      prCount,
    };
  });

  // Exercises you never touched are noise in a recap of what you did.
  const performed = rows.filter(row => row.setsDone > 0);

  return {
    title: session.title,
    startedAt: session.startedAt,
    endedAt,
    durationSec: Math.max(0, Math.floor((endedAt.getTime() - session.startedAt.getTime()) / 1000)),
    volumeKg: totals.volumeKg,
    setsDone: totals.setsDone,
    setsPlanned: totals.setsPlanned,
    exercisesDone: performed.length,
    exercises: performed,
    prs,
    feeling: session.feelingTag as FeelingId | undefined,
    notes: session.bodyNotes,
  };
}
