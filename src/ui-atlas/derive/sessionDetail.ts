import type { Exercise } from '../../core/entities/Exercise';
import type { WorkoutLog } from '../../core/entities/WorkoutLog';
import type { WorkoutSet } from '../../core/entities/WorkoutSet';
import type { FeelingId } from '../types';
import type { HistorySetVM } from './exerciseHistory';
import { isCountedSet } from './muscleLoad';
import { normalizeName } from './records';
import { setVolume } from './history';

/**
 * One past session, opened up.
 *
 * `buildHistory` gives a session's totals — the line you see in a list — but not
 * what it contained. Until now the only screen that showed the exercises of a
 * session was the recap that fires the moment you finish one, and it reads from
 * a throwaway store that is gone by the next launch. This rebuilds the same shape
 * from what was actually persisted, so any session is openable at any time.
 *
 * PR flags come from `annotatePrs`, which walks chronologically — a session keeps
 * the record it earned rather than losing it once a later session beats it.
 */

export interface SessionDetailExerciseVM {
  key: string;
  name: string;
  exerciseId?: string;
  /** Repo-relative catalogue path, or '' when the exercise is free-text. */
  image: string;
  sets: HistorySetVM[];
  volumeKg: number;
  /** Heaviest set of the exercise — the one line worth reading if you read one. */
  topSet: { weightKg: number; reps: number } | null;
  prCount: number;
}

export interface SessionDetailVM {
  id: string;
  at: Date;
  title: string;
  durationMin: number;
  volumeKg: number;
  setsDone: number;
  feeling?: FeelingId;
  notes?: string;
  exercises: SessionDetailExerciseVM[];
}

type ResolveExercise = (set: { exerciseId?: string; exerciseName: string }) => Exercise | undefined;

export function buildSessionDetail(
  log: WorkoutLog,
  sets: WorkoutSet[],
  prSetIds: Set<string> = new Set(),
  resolve?: ResolveExercise,
): SessionDetailVM {
  const counted = sets.filter(isCountedSet);

  // Insertion order is the order the exercises were performed, which is the
  // order the session actually happened in — worth preserving over any sort.
  const byExercise = new Map<string, WorkoutSet[]>();
  for (const set of [...counted].sort((a, b) => a.setNumber - b.setNumber)) {
    const key = normalizeName(set.exerciseName);
    if (!key) continue;
    byExercise.set(key, [...(byExercise.get(key) ?? []), set]);
  }

  const exercises: SessionDetailExerciseVM[] = [];
  for (const [key, group] of byExercise) {
    let volumeKg = 0;
    let topSet: { weightKg: number; reps: number } | null = null;
    let prCount = 0;

    const rows: HistorySetVM[] = group.map(set => {
      const weightKg = set.weight ?? 0;
      const reps = set.reps ?? 0;
      const isPr = Boolean(set.id && prSetIds.has(set.id));

      volumeKg += setVolume(set);
      if (!topSet || weightKg > topSet.weightKg) topSet = { weightKg, reps };
      if (isPr) prCount += 1;

      return { setNum: set.setNumber, weightKg, reps, isPr };
    });

    const first = group[0];
    const exercise = resolve?.(first);
    exercises.push({
      key,
      name: exercise?.name ?? first.exerciseName.trim(),
      // Any set of the group may carry the id; the first that does wins.
      exerciseId: exercise?.id ?? group.find(s => s.exerciseId)?.exerciseId,
      image: exercise?.image ?? '',
      sets: rows,
      volumeKg: Math.round(volumeKg),
      topSet,
      prCount,
    });
  }

  return {
    id: log.id ?? '',
    at: new Date(log.timestamp),
    title: log.type,
    durationMin: log.duration ?? 0,
    volumeKg: exercises.reduce((total, ex) => total + ex.volumeKg, 0),
    setsDone: counted.length,
    feeling: log.feelingTag as FeelingId | undefined,
    notes: log.bodyNotes || undefined,
    exercises,
  };
}
