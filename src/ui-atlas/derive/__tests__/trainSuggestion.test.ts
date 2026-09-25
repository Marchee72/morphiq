import { describe, expect, it } from 'vitest';
import type { WorkoutSet } from '../../../core/entities/WorkoutSet';
import type { RoutineTemplate } from '../../../core/entities/RoutineTemplate';
import { buildGroupHistory, suggestTraining } from '../trainSuggestion';
import { groupFromName } from '../muscleLoad';

const NOW = new Date(2026, 8, 25, 18, 0);
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

let id = 0;
const set = (name: string, days: number, log: string, reps = 8): WorkoutSet => ({
  id: String(++id), workoutLogId: log, profileId: '1', exerciseName: name, setNumber: 1,
  weight: 50, reps, timestamp: daysAgo(days), isCompleted: true,
});

const SETS = [
  set('Barbell Row', 9, 'pull'), set('Barbell Row', 9, 'pull'), set('Barbell Row', 9, 'pull', 6),
  set('Lat Pulldown', 9, 'pull'),
  set('Overhead Press', 8, 'shoulders'), set('Overhead Press', 8, 'shoulders'),
  set('Squat', 6, 'legs'),
  // Chest yesterday: still recovering, never suggested.
  set('Bench Press', 1, 'push'),
];

const history = buildGroupHistory(SETS, () => undefined);
const groupOf = (item: { exerciseName: string }) => groupFromName(item.exerciseName);
const routine = (title: string, names: string[]): RoutineTemplate => ({
  profileId: '1', title, description: '', targetMuscles: [], createdAt: NOW,
  exercises: names.map(n => ({ exerciseId: '', exerciseName: n, targetSets: 3 })),
});

describe('suggestTraining', () => {
  it('names the two groups rested longest, with the lifts last done for them', () => {
    const s = suggestTraining(history, [], groupOf, NOW)!;
    expect(s.groups.map(g => g.group)).toEqual(['back', 'shoulders']);
    expect(s.groups[0].daysSince).toBe(9);
    // The row as it was done: three sets, the last one of six reps.
    expect(s.exercises).toContainEqual(expect.objectContaining({ name: 'Barbell Row', sets: 3, reps: 6 }));
    expect(s.exercises.map(e => e.name)).not.toContain('Bench Press');
  });

  it('rotates to the next pair, and back round', () => {
    const second = suggestTraining(history, [], groupOf, NOW, 1)!;
    expect(second.groups.map(g => g.group)).toEqual(['quads']);
    expect(suggestTraining(history, [], groupOf, NOW, 2)!.groups[0].group).toBe('back');
  });

  it('points at the routine that is about those groups', () => {
    const s = suggestTraining(history, [
      routine('Push A', ['Bench Press', 'Overhead Press', 'Triceps Pushdown']),
      routine('Pull A', ['Barbell Row', 'Lat Pulldown', 'Barbell Curl']),
    ], groupOf, NOW)!;
    expect(s.routine?.title).toBe('Pull A');
  });

  it('suggests nothing when there is no history', () => {
    expect(suggestTraining(buildGroupHistory([], () => undefined), [], groupOf, NOW)).toBeNull();
  });
});
