import { describe, expect, it } from 'vitest';
import { buildExerciseHistory } from '../exerciseHistory';
import type { WorkoutSet } from '../../../core/entities/WorkoutSet';

const DAY = 86_400_000;
const NOW = new Date(2026, 6, 27, 18, 0);

let seq = 0;
function set(
  logId: string,
  daysAgo: number,
  setNumber: number,
  weight: number,
  reps: number,
  name = 'Barbell Bench Press',
): WorkoutSet {
  return {
    id: `s${seq++}`,
    workoutLogId: logId,
    profileId: 'p1',
    exerciseName: name,
    setNumber,
    weight,
    reps,
    isCompleted: true,
    timestamp: new Date(NOW.getTime() - daysAgo * DAY),
  };
}

describe('buildExerciseHistory', () => {
  it('groups sets into the session they belong to', () => {
    const history = buildExerciseHistory([
      set('w1', 7, 1, 80, 8),
      set('w1', 7, 2, 80, 8),
      set('w2', 3, 1, 85, 6),
    ], 'Barbell Bench Press');

    expect(history).toHaveLength(2);
    expect(history[0].sets).toHaveLength(1);
    expect(history[1].sets).toHaveLength(2);
  });

  it('puts the most recent session first', () => {
    const history = buildExerciseHistory([
      set('w1', 7, 1, 80, 8),
      set('w2', 3, 1, 85, 6),
      set('w3', 1, 1, 90, 4),
    ], 'Barbell Bench Press');

    expect(history.map(s => s.workoutLogId)).toEqual(['w3', 'w2', 'w1']);
  });

  it('orders sets within a session by set number, not by insertion', () => {
    const history = buildExerciseHistory([
      set('w1', 3, 3, 70, 10),
      set('w1', 3, 1, 80, 8),
      set('w1', 3, 2, 75, 9),
    ], 'Barbell Bench Press');

    expect(history[0].sets.map(s => s.setNum)).toEqual([1, 2, 3]);
  });

  it('reports volume and the heaviest set of each session', () => {
    const history = buildExerciseHistory([
      set('w1', 3, 1, 80, 10),
      set('w1', 3, 2, 100, 5),
      set('w1', 3, 3, 60, 12),
    ], 'Barbell Bench Press');

    expect(history[0].volumeKg).toBe(800 + 500 + 720);
    expect(history[0].topSet).toEqual({ weightKg: 100, reps: 5 });
  });

  it('ignores other exercises', () => {
    const history = buildExerciseHistory([
      set('w1', 3, 1, 80, 8),
      set('w1', 3, 1, 60, 10, 'Barbell Row'),
    ], 'Barbell Bench Press');

    expect(history[0].sets).toHaveLength(1);
    expect(history[0].sets[0].weightKg).toBe(80);
  });

  it('matches the name the way the rest of the derive layer does', () => {
    const history = buildExerciseHistory(
      [set('w1', 3, 1, 80, 8, '  BARBELL   bench press ')],
      'Barbell Bench Press',
    );
    expect(history).toHaveLength(1);
  });

  it('flags records as they stood at the time, not by today standards', () => {
    // 80x8 then 90x8: the second is a record. Getting stronger later must not
    // retroactively strip the badge off it.
    const history = buildExerciseHistory([
      set('w1', 9, 1, 80, 8),
      set('w2', 6, 1, 90, 8),
      set('w3', 3, 1, 120, 8),
    ], 'Barbell Bench Press');

    const byLog = Object.fromEntries(history.map(s => [s.workoutLogId, s.sets[0].isPr]));
    // The first ever set is a baseline, not a record.
    expect(byLog.w1).toBe(false);
    expect(byLog.w2).toBe(true);
    expect(byLog.w3).toBe(true);
  });

  it('does not flag a session that failed to beat the running best', () => {
    const history = buildExerciseHistory([
      set('w1', 9, 1, 80, 8),
      set('w2', 6, 1, 100, 8),
      set('w3', 3, 1, 85, 8),
    ], 'Barbell Bench Press');

    expect(history.find(s => s.workoutLogId === 'w3')!.sets[0].isPr).toBe(false);
  });

  it('caps how far back it reaches', () => {
    const many = Array.from({ length: 30 }, (_, i) => set(`w${i}`, 30 - i, 1, 80, 8));
    expect(buildExerciseHistory(many, 'Barbell Bench Press')).toHaveLength(12);
    expect(buildExerciseHistory(many, 'Barbell Bench Press', 3)).toHaveLength(3);
  });

  it('returns nothing for an exercise never logged, or for no name at all', () => {
    expect(buildExerciseHistory([set('w1', 3, 1, 80, 8)], 'Zercher Squat')).toEqual([]);
    expect(buildExerciseHistory([set('w1', 3, 1, 80, 8)], '')).toEqual([]);
  });
});
