import { describe, expect, it } from 'vitest';
import type { Exercise } from '../../../core/entities/Exercise';
import type { WorkoutSet } from '../../../core/entities/WorkoutSet';
import {
  buildMuscleLoad, CATEGORY_TO_GROUP, GROUP_TO_CATEGORIES, groupFromExercise,
  groupFromName, MUSCLE_GROUPS, resolveGroup,
} from '../muscleLoad';

const NOW = new Date(2026, 6, 27, 12);
const HOURS = 3_600_000;

function set(over: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    workoutLogId: 'w1', profileId: 'p1', exerciseName: 'Barbell Bench Press',
    setNumber: 1, weight: 60, reps: 10, isCompleted: true,
    timestamp: new Date(NOW.getTime() - 2 * HOURS), ...over,
  };
}

const exercise = (over: Partial<Exercise> = {}): Exercise => ({
  id: '0025', name: 'Barbell Bench Press', nameEs: 'Press de banca con barra', category: 'chest', equipment: 'barbell',
  target: 'pectorals', muscleGroup: 'chest', secondaryMuscles: [], instructionSteps: [], instructionStepsEs: [],
  image: 'images/0025.jpg', gifUrl: 'videos/0025.gif', attribution: '', ...over,
});

describe('category mapping', () => {
  it('maps every strength category the dataset actually contains', () => {
    // Verified against exercises.json; cardio and neck map to nothing on purpose.
    for (const category of ['chest', 'back', 'upper legs', 'lower legs', 'shoulders', 'upper arms', 'lower arms', 'waist']) {
      expect(CATEGORY_TO_GROUP[category], category).toBeTruthy();
    }
    expect(CATEGORY_TO_GROUP['cardio']).toBeUndefined();
  });

  it('keeps GROUP_TO_CATEGORIES a true inverse', () => {
    for (const group of MUSCLE_GROUPS) {
      for (const category of GROUP_TO_CATEGORIES[group]) {
        expect(CATEGORY_TO_GROUP[category]).toBe(group);
      }
    }
  });
});

describe('groupFromExercise', () => {
  it('resolves via category', () => {
    expect(groupFromExercise(exercise({ category: 'upper legs' }))).toBe('legs');
    expect(groupFromExercise(exercise({ category: 'waist' }))).toBe('core');
  });

  it('falls back to target when the category is unknown', () => {
    expect(groupFromExercise(exercise({ category: 'mystery', target: 'biceps' }))).toBe('arms');
  });

  it('returns null for cardio rather than distorting a strength balance', () => {
    expect(groupFromExercise(exercise({ category: 'cardio', target: 'cardiovascular system' }))).toBeNull();
  });
});

describe('groupFromName', () => {
  it('attributes common English lifts', () => {
    expect(groupFromName('Incline Bench Press')).toBe('chest');
    expect(groupFromName('Barbell Row')).toBe('back');
    expect(groupFromName('Back Squat')).toBe('legs');
    expect(groupFromName('Lateral Raise')).toBe('shoulders');
    expect(groupFromName('Hammer Curl')).toBe('arms');
    expect(groupFromName('Hanging Leg Raise')).toBe('core');
  });

  it('attributes Spanish names, since much of the history was typed that way', () => {
    expect(groupFromName('Press de banca')).toBe('chest');
    expect(groupFromName('Dominadas')).toBe('back');
    expect(groupFromName('Sentadilla')).toBe('legs');
  });

  it('lets the movement win over a body-part word in the same name', () => {
    // The naive single-tier version got these wrong: "back" beat "squat".
    expect(groupFromName('Back Squat')).toBe('legs');
    expect(groupFromName('Front Squat')).toBe('legs');
    expect(groupFromName('Leg Curl')).toBe('legs');
    expect(groupFromName('Chest Supported Row')).toBe('back');
  });

  it('distinguishes raises that share a word but not a muscle', () => {
    expect(groupFromName('Calf Raise')).toBe('legs');
    expect(groupFromName('Hanging Leg Raise')).toBe('core');
    expect(groupFromName('Lateral Raise')).toBe('shoulders');
  });

  it('returns null for something genuinely unattributable', () => {
    expect(groupFromName('Morning routine')).toBeNull();
    expect(groupFromName('')).toBeNull();
  });
});

describe('resolveGroup', () => {
  it('prefers the catalogue over the name', () => {
    // The name says chest, the catalogue entry says legs — the catalogue is authoritative.
    expect(resolveGroup(set({ exerciseName: 'Bench Press' }), exercise({ category: 'upper legs' }))).toBe('legs');
  });

  it('falls back to the name for free-text sets', () => {
    expect(resolveGroup(set({ exerciseName: 'Sentadilla búlgara' }), undefined)).toBe('legs');
  });
});

describe('buildMuscleLoad', () => {
  const resolve = () => exercise();

  it('always returns all six groups in a fixed order', () => {
    const load = buildMuscleLoad([], () => undefined, NOW);
    expect(load.rows.map(r => r.group)).toEqual([...MUSCLE_GROUPS]);
  });

  it('counts completed sets inside the seven-day window', () => {
    const load = buildMuscleLoad([set(), set({ setNumber: 2 })], resolve, NOW);
    expect(load.rows.find(r => r.group === 'chest')!.sets).toBe(2);
  });

  it('ignores sets outside the window', () => {
    const old = set({ timestamp: new Date(NOW.getTime() - 200 * HOURS) });
    expect(buildMuscleLoad([old], resolve, NOW).rows.find(r => r.group === 'chest')!.sets).toBe(0);
  });

  it('ignores planned-but-not-performed sets', () => {
    const planned = set({ isCompleted: false });
    const noReps = set({ reps: 0 });
    expect(buildMuscleLoad([planned, noReps], resolve, NOW).rows.find(r => r.group === 'chest')!.sets).toBe(0);
  });

  it('reports unattributable sets instead of silently dropping them', () => {
    const load = buildMuscleLoad([set({ exerciseName: 'Mystery movement' })], () => undefined, NOW);
    expect(load.unmappedSets).toBe(1);
    expect(load.rows.every(r => r.sets === 0)).toBe(true);
  });

  it('reports a never-trained group as fully recovered', () => {
    expect(buildMuscleLoad([], () => undefined, NOW).rows[0].recoveredPct).toBe(100);
  });

  it('scales recovery against the group window', () => {
    // Chest recovers over 48 h; hit 24 h ago is halfway back.
    const recent = set({ timestamp: new Date(NOW.getTime() - 24 * HOURS) });
    const chest = buildMuscleLoad([recent], resolve, NOW).rows.find(r => r.group === 'chest')!;
    expect(chest.recoveredPct).toBe(50);
    expect(chest.lastHitAt).toEqual(recent.timestamp);
  });

  it('caps recovery at 100 rather than overshooting', () => {
    const old = set({ timestamp: new Date(NOW.getTime() - 100 * HOURS) });
    // Outside the 168 h count window? No — 100 h is inside, so it still registers.
    expect(buildMuscleLoad([old], resolve, NOW).rows.find(r => r.group === 'chest')!.recoveredPct).toBe(100);
  });

  it('tracks the most recent set timestamp per exercise', () => {
    const older = set({ timestamp: new Date(NOW.getTime() - 48 * HOURS) });
    const newer = set({ setNumber: 2, timestamp: new Date(NOW.getTime() - 2 * HOURS) });
    const chest = buildMuscleLoad([older, newer], resolve, NOW)
      .rows.find(r => r.group === 'chest')!;
    expect(chest.exercises).toHaveLength(1);
    expect(chest.exercises[0].lastHitAt).toEqual(newer.timestamp);
  });

  it('tracks the best set by weight × reps per exercise', () => {
    const light = set({ weight: 60, reps: 10, timestamp: new Date(NOW.getTime() - 48 * HOURS) });
    const heavy = set({ setNumber: 2, weight: 85, reps: 5, timestamp: new Date(NOW.getTime() - 2 * HOURS) });
    const chest = buildMuscleLoad([light, heavy], resolve, NOW)
      .rows.find(r => r.group === 'chest')!;
    expect(chest.exercises[0].bestSet).toEqual({ weightKg: 85, reps: 5 });
  });

  it('sorts exercises latest-to-oldest by lastHitAt', () => {
    const older = set({ timestamp: new Date(NOW.getTime() - 72 * HOURS) });
    const newer = set({ exerciseName: 'Incline Dumbbell Press', setNumber: 1, timestamp: new Date(NOW.getTime() - 2 * HOURS) });
    const chest = buildMuscleLoad([older, newer], resolve, NOW)
      .rows.find(r => r.group === 'chest')!;
    expect(chest.exercises[0].name).toBe('Incline Dumbbell Press');
    expect(chest.exercises[1].name).toBe('Barbell Bench Press');
  });
});
