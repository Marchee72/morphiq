import { describe, expect, it } from 'vitest';
import type { WorkoutSet } from '../../../core/entities/WorkoutSet';
import {
  annotatePrs, bestBefore, buildExerciseUsage, buildPersonalRecords,
  e1rm, isPrEligible, normalizeName, E1RM_MAX_REPS,
} from '../records';

const NOW = new Date(2026, 6, 27, 12);
const DAY = 86_400_000;

function set(over: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: 's1', workoutLogId: 'w1', profileId: 'p1', exerciseName: 'Bench Press',
    setNumber: 1, weight: 80, reps: 5, isCompleted: true, timestamp: NOW, ...over,
  };
}

describe('e1rm', () => {
  it('returns the weight itself for a single', () => {
    expect(e1rm(100, 1)).toBe(100);
  });

  it('scales with reps (Epley)', () => {
    expect(e1rm(90, 3)).toBeCloseTo(99, 5);
    expect(e1rm(80, 10)).toBeCloseTo(106.67, 1);
  });

  it('stays monotonic across the rep range', () => {
    // The reason Epley was chosen over Brzycki, which degenerates past ~10 reps.
    const scores = Array.from({ length: 12 }, (_, i) => e1rm(80, i + 1));
    for (let i = 1; i < scores.length; i++) expect(scores[i]).toBeGreaterThan(scores[i - 1]);
  });

  it('returns zero for bodyweight or empty sets', () => {
    expect(e1rm(0, 10)).toBe(0);
    expect(e1rm(80, 0)).toBe(0);
  });
});

describe('isPrEligible', () => {
  it('rejects high-rep sets, where e1RM stops predicting anything', () => {
    expect(isPrEligible(set({ reps: E1RM_MAX_REPS }))).toBe(true);
    expect(isPrEligible(set({ reps: E1RM_MAX_REPS + 1 }))).toBe(false);
  });

  it('rejects unloaded and unfinished sets', () => {
    expect(isPrEligible(set({ weight: 0 }))).toBe(false);
    expect(isPrEligible(set({ isCompleted: false }))).toBe(false);
  });
});

describe('normalizeName', () => {
  it('keys hand-typed and catalogue names to the same bucket', () => {
    expect(normalizeName('  Bench   Press ')).toBe('bench press');
    expect(normalizeName('BENCH PRESS')).toBe(normalizeName('bench press'));
  });
});

describe('buildExerciseUsage', () => {
  it('tracks last use, best load and session count per exercise', () => {
    const usage = buildExerciseUsage([
      set({ id: 'a', weight: 70, timestamp: new Date(NOW.getTime() - 10 * DAY) }),
      set({ id: 'b', weight: 90, workoutLogId: 'w2', timestamp: new Date(NOW.getTime() - DAY) }),
    ]);
    const bench = usage.get('bench press')!;
    expect(bench.bestKg).toBe(90);
    expect(bench.sessions).toBe(2);
    expect(bench.lastAt).toEqual(new Date(NOW.getTime() - DAY));
  });

  it('groups differently-cased names together', () => {
    const usage = buildExerciseUsage([set({ id: 'a' }), set({ id: 'b', exerciseName: 'bench press' })]);
    expect(usage.size).toBe(1);
  });

  it('backfills the catalogue id from whichever set carried one', () => {
    const usage = buildExerciseUsage([set({ id: 'a' }), set({ id: 'b', exerciseId: '0025' })]);
    expect(usage.get('bench press')!.exerciseId).toBe('0025');
  });

  it('ignores sets that were never performed', () => {
    expect(buildExerciseUsage([set({ isCompleted: false })]).size).toBe(0);
  });
});

describe('buildPersonalRecords', () => {
  it('ranks by e1RM, strongest first', () => {
    const records = buildPersonalRecords([
      set({ id: 'a', exerciseName: 'Squat', weight: 120, reps: 5 }),
      set({ id: 'b', exerciseName: 'Bench Press', weight: 90, reps: 3 }),
    ]);
    expect(records.map(r => r.exerciseName)).toEqual(['Squat', 'Bench Press']);
    expect(records[0].e1rm).toBeCloseTo(140, 0);
  });

  it('excludes exercises with no scoreable set', () => {
    expect(buildPersonalRecords([set({ weight: 0, exerciseName: 'Push-up' })])).toEqual([]);
  });
});

describe('annotatePrs', () => {
  it('treats the first set of an exercise as a baseline, not a record', () => {
    expect(annotatePrs([set({ id: 'a' })]).size).toBe(0);
  });

  it('flags a set that beat everything before it', () => {
    const prs = annotatePrs([
      set({ id: 'a', weight: 80, timestamp: new Date(NOW.getTime() - 2 * DAY) }),
      set({ id: 'b', weight: 90, timestamp: new Date(NOW.getTime() - DAY) }),
    ]);
    expect([...prs]).toEqual(['b']);
  });

  it('keeps a historical PR even after a later session beats it', () => {
    // Asking "is this a PR by today's standard" would strip the badge retroactively.
    const prs = annotatePrs([
      set({ id: 'a', weight: 80, timestamp: new Date(NOW.getTime() - 3 * DAY) }),
      set({ id: 'b', weight: 90, timestamp: new Date(NOW.getTime() - 2 * DAY) }),
      set({ id: 'c', weight: 100, timestamp: new Date(NOW.getTime() - DAY) }),
    ]);
    expect(prs.has('b')).toBe(true);
    expect(prs.has('c')).toBe(true);
  });

  it('is order-independent — it sorts before walking', () => {
    const later = set({ id: 'b', weight: 90, timestamp: new Date(NOW.getTime() - DAY) });
    const earlier = set({ id: 'a', weight: 80, timestamp: new Date(NOW.getTime() - 2 * DAY) });
    expect([...annotatePrs([later, earlier])]).toEqual(['b']);
  });
});

describe('bestBefore', () => {
  it('excludes sets from the session being scored', () => {
    const cutoff = new Date(NOW.getTime() - DAY);
    const best = bestBefore([
      set({ id: 'a', weight: 80, reps: 5, timestamp: new Date(NOW.getTime() - 2 * DAY) }),
      set({ id: 'b', weight: 200, timestamp: NOW }), // today's set must not be its own baseline
    ], cutoff);
    // The map holds e1RM, not raw load: 80 kg × 5 scores 93.3.
    expect(best.get('bench press')).toBeCloseTo(e1rm(80, 5), 5);
  });
});
