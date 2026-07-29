import { describe, expect, it } from 'vitest';
import { buildSessionDetail } from '../sessionDetail';
import { annotatePrs } from '../records';
import type { WorkoutLog } from '../../../core/entities/WorkoutLog';
import type { WorkoutSet } from '../../../core/entities/WorkoutSet';

const AT = new Date(2026, 6, 26, 18, 0);

const log: WorkoutLog = {
  id: 'w1',
  profileId: 'p1',
  timestamp: AT,
  type: 'Push A',
  duration: 62,
  description: '',
  feelingTag: 'good',
  bodyNotes: 'Shoulder felt tight.',
};

let seq = 0;
function set(
  name: string,
  setNumber: number,
  weight: number,
  reps: number,
  extra: Partial<WorkoutSet> = {},
): WorkoutSet {
  return {
    id: `s${seq++}`,
    workoutLogId: 'w1',
    profileId: 'p1',
    exerciseName: name,
    setNumber,
    weight,
    reps,
    isCompleted: true,
    timestamp: AT,
    ...extra,
  };
}

describe('buildSessionDetail', () => {
  it('groups sets under the exercise they belong to', () => {
    const detail = buildSessionDetail(log, [
      set('Barbell Bench Press', 1, 80, 8),
      set('Barbell Row', 1, 70, 10),
      set('Barbell Bench Press', 2, 82.5, 8),
    ]);

    expect(detail.exercises).toHaveLength(2);
    expect(detail.exercises[0].name).toBe('Barbell Bench Press');
    expect(detail.exercises[0].sets).toHaveLength(2);
    expect(detail.exercises[1].sets).toHaveLength(1);
  });

  it('keys on the normalized name, so casing and spacing do not split an exercise', () => {
    const detail = buildSessionDetail(log, [
      set('Barbell Bench Press', 1, 80, 8),
      set('  BARBELL   bench press ', 2, 82.5, 8),
    ]);

    expect(detail.exercises).toHaveLength(1);
    expect(detail.exercises[0].sets).toHaveLength(2);
  });

  it('orders sets by set number, not by insertion', () => {
    const detail = buildSessionDetail(log, [
      set('Barbell Bench Press', 3, 70, 10),
      set('Barbell Bench Press', 1, 80, 8),
      set('Barbell Bench Press', 2, 75, 9),
    ]);

    expect(detail.exercises[0].sets.map(s => s.setNum)).toEqual([1, 2, 3]);
  });

  it('reports volume and the heaviest set per exercise, and the session total', () => {
    const detail = buildSessionDetail(log, [
      set('Barbell Bench Press', 1, 80, 10),
      set('Barbell Bench Press', 2, 100, 5),
      set('Barbell Row', 1, 60, 12),
    ]);

    const bench = detail.exercises[0];
    expect(bench.volumeKg).toBe(800 + 500);
    expect(bench.topSet).toEqual({ weightKg: 100, reps: 5 });
    expect(detail.volumeKg).toBe(800 + 500 + 720);
  });

  it('excludes sets that were never performed', () => {
    const detail = buildSessionDetail(log, [
      set('Barbell Bench Press', 1, 80, 8),
      // Planned but skipped: no reps.
      set('Barbell Bench Press', 2, 80, 0),
      set('Barbell Bench Press', 3, 80, 8, { isCompleted: false }),
    ]);

    expect(detail.setsDone).toBe(1);
    expect(detail.exercises[0].sets).toHaveLength(1);
  });

  it('carries the record flags it is given, and counts them per exercise', () => {
    const bench = [
      set('Barbell Bench Press', 1, 80, 8),
      set('Barbell Bench Press', 2, 100, 8),
    ];
    // Chronological walk: the first is a baseline, the second beats it.
    const detail = buildSessionDetail(log, bench, annotatePrs(bench));

    expect(detail.exercises[0].sets.map(s => s.isPr)).toEqual([false, true]);
    expect(detail.exercises[0].prCount).toBe(1);
  });

  it('carries the log header through', () => {
    const detail = buildSessionDetail(log, [set('Barbell Bench Press', 1, 80, 8)]);

    expect(detail.id).toBe('w1');
    expect(detail.title).toBe('Push A');
    expect(detail.durationMin).toBe(62);
    expect(detail.at).toEqual(AT);
    expect(detail.feeling).toBe('good');
    expect(detail.notes).toBe('Shoulder felt tight.');
  });

  it('resolves the catalogue entry when one is offered', () => {
    const detail = buildSessionDetail(
      log,
      [set('barbell bench press', 1, 80, 8, { exerciseId: '0025' })],
      new Set(),
      () => ({
        id: '0025',
        name: 'Barbell Bench Press',
        image: 'exercises/0025.jpg',
      } as never),
    );

    expect(detail.exercises[0].name).toBe('Barbell Bench Press');
    expect(detail.exercises[0].image).toBe('exercises/0025.jpg');
    expect(detail.exercises[0].exerciseId).toBe('0025');
  });

  it('survives a session with nothing logged', () => {
    const detail = buildSessionDetail(log, []);
    expect(detail.exercises).toEqual([]);
    expect(detail.volumeKg).toBe(0);
    expect(detail.setsDone).toBe(0);
  });
});
