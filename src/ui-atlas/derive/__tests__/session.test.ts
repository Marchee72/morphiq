import { describe, expect, it } from 'vitest';
import type { Exercise } from '../../../core/entities/Exercise';
import {
  buildSessionExercises, buildSessionTotals, findCursor, restSecFor,
  DEFAULT_REST_SEC, type DraftSet, type SessionExerciseInput,
} from '../session';

const exercise = (over: Partial<Exercise> = {}): Exercise => ({
  id: '0025', name: 'Barbell Bench Press', category: 'chest', equipment: 'barbell',
  target: 'pectorals', muscleGroup: 'chest', secondaryMuscles: [], instructionSteps: [],
  image: 'images/0025.jpg', gifUrl: 'videos/0025.gif', attribution: '', ...over,
});

const planned: SessionExerciseInput[] = [
  { id: 'e1', exerciseId: '0025', exerciseName: 'Barbell Bench Press', targetSets: 3, targetReps: 8 },
];

const draft = (over: Partial<DraftSet> = {}): DraftSet => ({
  exerciseName: 'Barbell Bench Press', setNumber: 1, weight: 60, reps: 8, isCompleted: true, ...over,
});

const noExercise = () => undefined;
const noAnchors = () => null;

describe('restSecFor', () => {
  it('gives heavy compounds a longer window than isolation work', () => {
    expect(restSecFor(exercise({ equipment: 'barbell' }))).toBe(150);
    expect(restSecFor(exercise({ equipment: 'cable' }))).toBe(75);
    expect(restSecFor(exercise({ equipment: 'body weight' }))).toBe(60);
  });

  it('falls back to the default for unknown or missing equipment', () => {
    expect(restSecFor(exercise({ equipment: 'tire' }))).toBe(DEFAULT_REST_SEC);
    expect(restSecFor(undefined)).toBe(DEFAULT_REST_SEC);
  });
});

describe('buildSessionExercises', () => {
  it('pads the planned set count with empty sets', () => {
    const [ex] = buildSessionExercises(planned, [draft()], () => exercise(), noAnchors);
    expect(ex.sets).toHaveLength(3);
    expect(ex.sets[0].done).toBe(true);
    expect(ex.sets[2].done).toBe(false);
    // Unlogged sets pre-fill from the plan's target reps.
    expect(ex.sets[2].reps).toBe(8);
  });

  it('grows past the plan when extra sets are logged', () => {
    const sets = [draft(), draft({ setNumber: 2 }), draft({ setNumber: 3 }), draft({ setNumber: 4 })];
    expect(buildSessionExercises(planned, sets, () => exercise(), noAnchors)[0].sets).toHaveLength(4);
  });

  it('recovers the exercise list from logged sets for a freestyle session', () => {
    const sets = [draft(), draft({ exerciseName: 'Squat', setNumber: 1 })];
    const built = buildSessionExercises(undefined, sets, noExercise, noAnchors);
    expect(built.map(e => e.name)).toEqual(['Barbell Bench Press', 'Squat']);
  });

  it('carries catalogue metadata through', () => {
    const [ex] = buildSessionExercises(planned, [], () => exercise(), noAnchors);
    expect(ex.target).toBe('pectorals');
    expect(ex.image).toBe('images/0025.jpg');
    expect(ex.restSec).toBe(150);
  });

  it('degrades cleanly when the exercise is not in the catalogue', () => {
    const [ex] = buildSessionExercises(planned, [], noExercise, noAnchors);
    expect(ex.target).toBe('');
    expect(ex.image).toBe('');
    expect(ex.restSec).toBe(DEFAULT_REST_SEC);
  });

  it('anchors each set to the matching set from last session', () => {
    const anchors = () => ({ lastSets: [{ weight: 57.5, reps: 8 }, { weight: 60, reps: 6 }] });
    const [ex] = buildSessionExercises(planned, [], () => exercise(), anchors);
    expect(ex.sets[0].lastWeightKg).toBe(57.5);
    expect(ex.sets[1].lastReps).toBe(6);
  });

  it('falls back to the top set once last session runs out of sets', () => {
    const anchors = () => ({ lastSets: [{ weight: 57.5, reps: 8 }], lastMaxWeight: 60, prReps: 5 });
    const [ex] = buildSessionExercises(planned, [], () => exercise(), anchors);
    expect(ex.sets[2].lastWeightKg).toBe(60);
  });

  it('flags a set that beats the pre-session best', () => {
    const best = new Map([['barbell bench press', 80]]);
    const heavy = [draft({ weight: 100, reps: 5 })];
    const [ex] = buildSessionExercises(planned, heavy, () => exercise(), noAnchors, best);
    expect(ex.sets[0].isPr).toBe(true);
  });

  it('does not flag a set below the pre-session best', () => {
    const best = new Map([['barbell bench press', 200]]);
    const [ex] = buildSessionExercises(planned, [draft()], () => exercise(), noAnchors, best);
    expect(ex.sets[0].isPr).toBe(false);
  });
});

describe('buildSessionTotals', () => {
  it('counts only completed sets toward volume', () => {
    const sets = [draft({ weight: 60, reps: 10 }), draft({ setNumber: 2, isCompleted: false })];
    const totals = buildSessionTotals(buildSessionExercises(planned, sets, () => exercise(), noAnchors));
    expect(totals.volumeKg).toBe(600);
    expect(totals.setsDone).toBe(1);
    expect(totals.setsPlanned).toBe(3);
  });

  it('is zero for a session with nothing logged', () => {
    const totals = buildSessionTotals(buildSessionExercises(planned, [], () => exercise(), noAnchors));
    expect(totals).toMatchObject({ volumeKg: 0, setsDone: 0, setsPlanned: 3, prs: 0 });
  });
});

describe('findCursor', () => {
  it('lands on the first set not yet done', () => {
    const built = buildSessionExercises(planned, [draft()], () => exercise(), noAnchors);
    expect(findCursor(built)).toEqual({ exerciseIdx: 0, setIdx: 1 });
  });

  it('moves to the next exercise once one is finished', () => {
    const two: SessionExerciseInput[] = [
      { id: 'e1', exerciseName: 'Bench', targetSets: 1 },
      { id: 'e2', exerciseName: 'Squat', targetSets: 2 },
    ];
    const sets = [draft({ exerciseName: 'Bench' })];
    expect(findCursor(buildSessionExercises(two, sets, noExercise, noAnchors))).toEqual({ exerciseIdx: 1, setIdx: 0 });
  });

  it('parks on the last set rather than going out of bounds when everything is done', () => {
    const done = [draft(), draft({ setNumber: 2 }), draft({ setNumber: 3 })];
    expect(findCursor(buildSessionExercises(planned, done, () => exercise(), noAnchors))).toEqual({ exerciseIdx: 0, setIdx: 2 });
  });

  it('does not throw on an empty session', () => {
    expect(findCursor([])).toEqual({ exerciseIdx: 0, setIdx: 0 });
  });
});
