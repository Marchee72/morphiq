import { useCallback } from 'react';
import type { WorkoutSet } from '../../core/entities/WorkoutSet';
import { useStore } from '../../presentation/state/store';
import { cancelActiveWorkoutNotification } from '../../data/health/ActiveWorkoutNotification';
import { useAppData } from './useAppData';
import type { SessionCursor, SessionExerciseVM } from '../types';

type DraftSet = Omit<WorkoutSet, 'profileId' | 'timestamp' | 'workoutLogId'>;

/**
 * Live-session behaviour, without any markup.
 *
 * Extracted from `LiveWorkoutScreen` before either Train screen was written, so
 * the two concepts render the same logic rather than reimplementing it twice.
 * Losing set data mid-workout is the worst bug this app could have, and two
 * parallel implementations of set mutation is how that happens.
 *
 * The store owns the sets; this hook only translates a screen's intent
 * ("log the current set", "go to the next one") into store mutations.
 */
export interface LiveSession {
  exercises: SessionExerciseVM[];
  cursor: SessionCursor;
  exercise: SessionExerciseVM | undefined;
  setIdx: number;

  /** Writes weight/reps and marks the set done, then moves to the next outstanding set. */
  logSet(weightKg: number, reps: number): void;
  /** Writes weight/reps without completing — used while nudging the numbers. */
  editSet(weightKg: number, reps: number): void;
  addSet(): void;
  removeSet(setIdx: number): void;

  goTo(exerciseIdx: number, setIdx: number): void;
  goToExercise(exerciseIdx: number): void;

  addExercise(exercise: { id?: string; name: string }): void;
  swapExercise(index: number, exercise: { id?: string; name: string }): void;
  removeExercise(index: number): void;
  reorderExercises(from: number, to: number): void;

  setFeeling(tag?: string, notes?: string): void;
  finish(): Promise<void>;
  discard(): Promise<void>;
}

/** Holds a cursor inside the list it points into, whatever happened to that list. */
export function clampCursor(cursor: SessionCursor, exercises: SessionExerciseVM[]): SessionCursor {
  if (exercises.length === 0) return { exerciseIdx: 0, setIdx: 0 };
  const exerciseIdx = Math.min(Math.max(0, cursor.exerciseIdx), exercises.length - 1);
  const sets = exercises[exerciseIdx].sets.length;
  return { exerciseIdx, setIdx: Math.min(Math.max(0, cursor.setIdx), Math.max(0, sets - 1)) };
}

export function useLiveSession(
  cursorOverride?: SessionCursor,
  onCursorChange?: (cursor: SessionCursor) => void,
): LiveSession {
  const { sessionExercises, cursor: derivedCursor } = useAppData();

  /**
   * The override is a screen's local state and the exercise list is not — remove
   * or swap an exercise and the two disagree. An out-of-range cursor resolves to
   * `undefined`, which the Train screen reads as "this session has no exercises"
   * and renders an empty state over a session that still has plenty. Clamping
   * here rather than in the screen keeps every consumer of the hook honest.
   */
  const cursor = clampCursor(cursorOverride ?? derivedCursor, sessionExercises);
  const exercise = sessionExercises[cursor.exerciseIdx];

  /**
   * Sets live in the store as a flat list across the whole session, so a write
   * has to find the row matching this exercise and set number — the screens
   * only ever know "exercise 2, set 3".
   */
  const writeSet = useCallback((
    exerciseIdx: number,
    setIdx: number,
    patch: Partial<DraftSet>,
  ) => {
    const store = useStore.getState();
    const session = store.activeSession;
    const target = sessionExercises[exerciseIdx];
    if (!session || !target) return;

    const name = target.name;
    const setNumber = setIdx + 1;
    const existing = session.sets.findIndex(
      s => s.exerciseName === name && s.setNumber === setNumber,
    );

    const next = [...session.sets];
    if (existing >= 0) {
      next[existing] = { ...next[existing], ...patch };
    } else {
      next.push({
        exerciseName: name,
        exerciseId: target.exerciseId,
        setNumber,
        weight: 0,
        reps: 0,
        isCompleted: false,
        ...patch,
      });
    }
    store.updateActiveSessionSets(next);
  }, [sessionExercises]);

  const logSet = useCallback((weightKg: number, reps: number) => {
    writeSet(cursor.exerciseIdx, cursor.setIdx, { weight: weightKg, reps, isCompleted: true });

    // Advance to whatever is still outstanding after this write.
    const target = sessionExercises[cursor.exerciseIdx];
    if (target && cursor.setIdx + 1 < target.sets.length) {
      onCursorChange?.({ exerciseIdx: cursor.exerciseIdx, setIdx: cursor.setIdx + 1 });
    } else if (cursor.exerciseIdx + 1 < sessionExercises.length) {
      onCursorChange?.({ exerciseIdx: cursor.exerciseIdx + 1, setIdx: 0 });
    }
  }, [writeSet, cursor, sessionExercises, onCursorChange]);

  const editSet = useCallback((weightKg: number, reps: number) => {
    writeSet(cursor.exerciseIdx, cursor.setIdx, { weight: weightKg, reps });
  }, [writeSet, cursor]);

  const addSet = useCallback(() => {
    const target = sessionExercises[cursor.exerciseIdx];
    if (!target) return;
    const last = target.sets[target.sets.length - 1];
    writeSet(cursor.exerciseIdx, target.sets.length, {
      weight: last?.weightKg ?? 0,
      reps: last?.reps ?? 10,
      isCompleted: false,
    });
  }, [sessionExercises, cursor.exerciseIdx, writeSet]);

  const removeSet = useCallback((setIdx: number) => {
    const store = useStore.getState();
    const session = store.activeSession;
    const target = sessionExercises[cursor.exerciseIdx];
    if (!session || !target) return;

    const remaining = session.sets
      .filter(s => !(s.exerciseName === target.name && s.setNumber === setIdx + 1))
      // Set numbers must stay contiguous or the next write lands in a gap.
      .map(s => (s.exerciseName === target.name && s.setNumber > setIdx + 1
        ? { ...s, setNumber: s.setNumber - 1 }
        : s));
    store.updateActiveSessionSets(remaining);
  }, [sessionExercises, cursor.exerciseIdx]);

  const finish = useCallback(async () => {
    await cancelActiveWorkoutNotification().catch(() => { /* notification is best-effort */ });
    await useStore.getState().finishActiveSession();
    // Reload so the session that just ended counts toward records and balance.
    await useStore.getState().loadAllSets().catch(() => { /* degrades to the loaded window */ });
    useStore.getState().setActiveTab('today');
  }, []);

  const discard = useCallback(async () => {
    await cancelActiveWorkoutNotification().catch(() => { /* notification is best-effort */ });
    useStore.getState().dismissActiveSession();
    useStore.getState().setActiveTab('today');
  }, []);

  return {
    exercises: sessionExercises,
    cursor,
    exercise,
    setIdx: cursor.setIdx,
    logSet,
    editSet,
    addSet,
    removeSet,
    goTo: (exerciseIdx, setIdx) => onCursorChange?.({ exerciseIdx, setIdx }),
    goToExercise: exerciseIdx => onCursorChange?.({ exerciseIdx, setIdx: 0 }),
    addExercise: ex => useStore.getState().addActiveSessionExercise(ex),
    swapExercise: (index, ex) => useStore.getState().swapActiveSessionExercise(index, ex),
    removeExercise: index => useStore.getState().removeActiveSessionExercise(index),
    reorderExercises: (from, to) => useStore.getState().reorderActiveSessionExercises(from, to),
    setFeeling: (tag, notes) => useStore.getState().updateActiveSessionNote(
      tag as 'feeling_100' | 'good' | 'sore' | 'pain' | 'low_energy' | undefined,
      notes,
    ),
    finish,
    discard,
  };
}
