import { describe, expect, it } from 'vitest';
import type { WorkoutSet } from '../../../core/entities/WorkoutSet';
import {
  BORG_MAX, BORG_MIN, BORG_QUICK, BORG_VALUES,
  borgLabelKey, exerciseRpe, isValidBorg, sessionRpe, sessionRpeFromExercises, trainingLoad,
} from '../borg';

function set(over: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    workoutLogId: 'w1',
    profileId: 'p1',
    exerciseName: 'Bench Press',
    setNumber: 1,
    weight: 80,
    reps: 8,
    isCompleted: true,
    timestamp: new Date('2026-06-27T10:00:00'),
    ...over,
  };
}

describe('the scale itself', () => {
  it('runs 6 to 20 inclusive with no gaps', () => {
    expect(BORG_VALUES).toHaveLength(15);
    expect(BORG_VALUES[0]).toBe(BORG_MIN);
    expect(BORG_VALUES.at(-1)).toBe(BORG_MAX);
  });

  it('rejects everything that is not a whole rating on the scale', () => {
    expect(isValidBorg(13)).toBe(true);
    expect(isValidBorg(5)).toBe(false);
    expect(isValidBorg(21)).toBe(false);
    expect(isValidBorg(13.5)).toBe(false);
    expect(isValidBorg('13')).toBe(false);
    expect(isValidBorg(undefined)).toBe(false);
    // A 0 from a half-written row is not "no effort", it is not on the scale.
    expect(isValidBorg(0)).toBe(false);
  });

  it('offers only ratings that exist on the scale as quick picks', () => {
    for (const quick of BORG_QUICK) expect(isValidBorg(quick)).toBe(true);
  });
});

describe('borgLabelKey', () => {
  it('groups the fifteen ratings onto seven descriptions', () => {
    expect(borgLabelKey(6)).toBe('borg.noExertion');
    expect(borgLabelKey(7)).toBe('borg.veryLight');
    expect(borgLabelKey(9)).toBe('borg.veryLight');
    expect(borgLabelKey(11)).toBe('borg.light');
    expect(borgLabelKey(13)).toBe('borg.somewhatHard');
    expect(borgLabelKey(15)).toBe('borg.hard');
    expect(borgLabelKey(17)).toBe('borg.veryHard');
    expect(borgLabelKey(20)).toBe('borg.maximal');
  });

  it('clamps rather than returning nothing for an off-scale value', () => {
    expect(borgLabelKey(3)).toBe('borg.noExertion');
    expect(borgLabelKey(99)).toBe('borg.maximal');
  });
});

describe('exerciseRpe', () => {
  it('reads the exercise rating off whichever set carries it', () => {
    expect(exerciseRpe([set({ rpe: 15 }), set({ rpe: 15 })])).toBe(15);
  });

  it('skips sets added after the exercise was rated', () => {
    expect(exerciseRpe([set(), set({ rpe: 17 })])).toBe(17);
  });

  it('is null, not zero, when nothing was rated', () => {
    expect(exerciseRpe([set(), set()])).toBeNull();
  });

  it('ignores a rating that is not on the scale', () => {
    expect(exerciseRpe([set({ rpe: 0 }), set({ rpe: 13 })])).toBe(13);
  });
});

describe('sessionRpe', () => {
  it('averages only over rated sets', () => {
    const { avg, max } = sessionRpe([set({ rpe: 13 }), set({ rpe: 17 }), set()]);
    expect(avg).toBe(15);
    expect(max).toBe(17);
  });

  it('reports null rather than a zero nobody entered', () => {
    expect(sessionRpe([set(), set()])).toEqual({ avg: null, max: null });
    expect(sessionRpe([])).toEqual({ avg: null, max: null });
  });

  it('leaves out sets that were never performed', () => {
    // `isCountedSet`: not completed, or no reps, means it did not happen.
    const { avg } = sessionRpe([
      set({ rpe: 19, isCompleted: false }),
      set({ rpe: 11 }),
      set({ rpe: 19, reps: 0 }),
    ]);
    expect(avg).toBe(11);
  });
});

describe('sessionRpeFromExercises', () => {
  it('weights each exercise by how many of its sets are done', () => {
    // 19 over four sets and 11 over one: the session was mostly hard, and the
    // mean has to say so rather than landing at 15.
    const { avg, max } = sessionRpeFromExercises([
      { rpe: 19, sets: [{ done: true }, { done: true }, { done: true }, { done: true }] },
      { rpe: 11, sets: [{ done: true }] },
    ]);
    expect(avg).toBe(17.4);
    expect(max).toBe(19);
  });

  it('ignores an exercise that is rated but has nothing logged', () => {
    const { avg } = sessionRpeFromExercises([
      { rpe: 20, sets: [{ done: false }, { done: false }] },
      { rpe: 13, sets: [{ done: true }] },
    ]);
    expect(avg).toBe(13);
  });

  it('is null when no exercise was rated', () => {
    expect(sessionRpeFromExercises([{ sets: [{ done: true }] }]))
      .toEqual({ avg: null, max: null });
  });
});

describe('trainingLoad', () => {
  it('is exertion times minutes', () => {
    expect(trainingLoad(15, 60)).toBe(900);
  });

  it('has nothing to report without a rating or without a duration', () => {
    expect(trainingLoad(null, 60)).toBeNull();
    expect(trainingLoad(15, 0)).toBeNull();
  });
});
