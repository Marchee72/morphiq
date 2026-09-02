import { describe, expect, it } from 'vitest';
import type { WorkoutSet } from '../../../core/entities/WorkoutSet';
import { buildExerciseStats, windowWeeks } from '../exerciseStats';

const NOW = new Date(2026, 6, 27, 18, 30);
const DAY = 86_400_000;
const WEEK = 7 * DAY;

let seq = 0;

function set(over: Partial<WorkoutSet> & { weeksAgo?: number } = {}): WorkoutSet {
  const { weeksAgo = 0, ...rest } = over;
  seq += 1;
  return {
    id: `s${seq}`,
    workoutLogId: `w${weeksAgo}`,
    profileId: 'p1',
    exerciseName: 'Bench Press',
    setNumber: 1,
    weight: 80,
    reps: 8,
    isCompleted: true,
    timestamp: new Date(NOW.getTime() - weeksAgo * WEEK - DAY),
    ...rest,
  };
}

const build = (sets: WorkoutSet[], window: Parameters<typeof buildExerciseStats>[2] = '8w') =>
  buildExerciseStats(sets, 'Bench Press', window, NOW);

describe('buildExerciseStats', () => {
  it('is null for an exercise with no history at all', () => {
    expect(build([])).toBeNull();
    expect(buildExerciseStats([set()], 'Overhead Press', '8w', NOW)).toBeNull();
  });

  it('counts only the exercise it was asked about', () => {
    const stats = build([
      set({ weeksAgo: 1 }),
      set({ weeksAgo: 1, exerciseName: 'Barbell Squat', weight: 200 }),
    ]);
    expect(stats?.totalSets).toBe(1);
    expect(stats?.best?.weightKg).toBe(80);
  });

  it('matches on the normalized name, the way every other join does', () => {
    const stats = build([set({ weeksAgo: 1, exerciseName: '  bench   press ' })]);
    expect(stats?.totalSets).toBe(1);
  });

  it('leaves out sets that were never performed', () => {
    const stats = build([
      set({ weeksAgo: 1 }),
      set({ weeksAgo: 1, isCompleted: false, weight: 200 }),
      set({ weeksAgo: 1, reps: 0, weight: 200 }),
    ]);
    expect(stats?.totalSets).toBe(1);
    expect(stats?.totalVolumeKg).toBe(640);
  });
});

describe('the window', () => {
  it('trims history outside it', () => {
    const sets = [set({ weeksAgo: 20 }), set({ weeksAgo: 2 })];
    expect(build(sets, '8w')?.totalSets).toBe(1);
    expect(build(sets, '6m')?.totalSets).toBe(2);
  });

  it('reports an empty window rather than pretending the exercise is unknown', () => {
    // Every set is older than eight weeks. The exercise exists; `null` here
    // would render "no such exercise" over real history.
    const stats = build([set({ weeksAgo: 30 })], '8w');
    expect(stats).not.toBeNull();
    expect(stats?.sessions).toBe(0);
    expect(stats?.e1rmSeries).toBeNull();
    expect(stats?.lastAt).toBeInstanceOf(Date);
  });

  it('sizes "all" from the first set, not from a constant', () => {
    // Three weeks of history must not be drawn as two years of flat fill.
    expect(windowWeeks('all', [set({ weeksAgo: 3 })], NOW)).toBe(4);
    expect(windowWeeks('all', [set({ weeksAgo: 500 })], NOW)).toBe(104);
    expect(windowWeeks('8w', [set({ weeksAgo: 500 })], NOW)).toBe(8);
  });
});

describe('the e1RM series', () => {
  it('takes the best of the week, not the mean', () => {
    // A top set and two back-offs in one week. Averaging would bury the number
    // the chart exists to show.
    const stats = build([
      set({ weeksAgo: 1, weight: 100, reps: 3 }),
      set({ weeksAgo: 1, weight: 60, reps: 3 }),
      set({ weeksAgo: 1, weight: 60, reps: 3 }),
    ]);
    // Epley: 100 * (1 + 3/30) = 110
    expect(stats?.e1rmSeries?.at(-1)).toBe(110);
    expect(stats?.currentE1rm).toBe(110);
  });

  it('does not score sets past the rep ceiling', () => {
    // `E1RM_MAX_REPS` is 12 — above it Epley stops predicting anything.
    const stats = build([set({ weeksAgo: 1, weight: 40, reps: 20 })]);
    expect(stats?.currentE1rm).toBeNull();
    expect(stats?.best).toBeNull();
    // The set still happened, so volume and count include it.
    expect(stats?.totalSets).toBe(1);
    expect(stats?.totalVolumeKg).toBe(800);
  });

  it('reports a change only once there are two sessions to compare', () => {
    expect(build([set({ weeksAgo: 1, weight: 100, reps: 1 })])?.e1rmDelta).toBeNull();

    const stats = build([
      set({ weeksAgo: 4, weight: 90, reps: 1 }),
      set({ weeksAgo: 1, weight: 100, reps: 1 }),
    ]);
    expect(stats?.e1rmDelta).toBe(10);
  });
});

describe('the volume series', () => {
  it('sums the week rather than taking its peak', () => {
    // A week is the unit training is planned in: two sessions of 800 kg is a
    // heavier week than one.
    const stats = build([
      set({ weeksAgo: 1, weight: 80, reps: 10 }),
      set({ weeksAgo: 1, weight: 80, reps: 10 }),
    ]);
    expect(stats?.volumeSeries?.at(-1)).toBe(1600);
  });
});

describe('stalledWeeks', () => {
  it('is null with only one scoreable session — that is a baseline', () => {
    expect(build([set({ weeksAgo: 1, weight: 100, reps: 1 })])?.stalledWeeks).toBeNull();
  });

  it('measures from the session that set the standing best', () => {
    const stats = build([
      set({ weeksAgo: 6, weight: 100, reps: 1 }),
      set({ weeksAgo: 1, weight: 95, reps: 1 }),
    ]);
    expect(stats?.stalledWeeks).toBe(6);
  });

  it('resets when the best actually moves', () => {
    const stats = build([
      set({ weeksAgo: 6, weight: 100, reps: 1 }),
      set({ weeksAgo: 1, weight: 105, reps: 1 }),
    ]);
    expect(stats?.stalledWeeks).toBe(1);
  });

  it('does not count weeks away from the gym as weeks of stalling', () => {
    // Two sessions six weeks apart with nothing between them. The filled series
    // has a value for every week; the stall must be measured off the sessions.
    const stats = build([
      set({ weeksAgo: 7, weight: 100, reps: 1 }),
      set({ weeksAgo: 1, weight: 120, reps: 1 }),
    ], '6m');
    expect(stats?.e1rmSeries).toHaveLength(26);
    expect(stats?.stalledWeeks).toBe(1);
  });
});

describe('best by rep range', () => {
  it('ranks by weight, not by estimated max', () => {
    // 100x3 scores 110 and 95x3 scores 104.5, but "my best triple" is the
    // heavier bar, and both live in the same band.
    const stats = build([
      set({ weeksAgo: 1, weight: 95, reps: 3 }),
      set({ weeksAgo: 1, weight: 100, reps: 3 }),
    ]);
    expect(stats?.repRangeBests).toHaveLength(1);
    expect(stats?.repRangeBests[0]).toMatchObject({ rangeKey: 'stats.reps1to3', weightKg: 100, reps: 3 });
  });

  it('splits the bands and omits the empty ones', () => {
    const stats = build([
      set({ weeksAgo: 1, weight: 100, reps: 3 }),
      set({ weeksAgo: 1, weight: 80, reps: 8 }),
      set({ weeksAgo: 1, weight: 40, reps: 20 }),
    ]);
    expect(stats?.repRangeBests.map(b => b.rangeKey))
      .toEqual(['stats.reps1to3', 'stats.reps7to10', 'stats.reps16plus']);
  });
});

describe('effort', () => {
  it('averages the ratings carried by the sets', () => {
    const stats = build([
      set({ weeksAgo: 1, rpe: 13 }),
      set({ weeksAgo: 1, rpe: 17 }),
    ]);
    expect(stats?.avgRpe).toBe(15);
  });

  it('is null rather than zero when the exercise was never rated', () => {
    expect(build([set({ weeksAgo: 1 })])?.avgRpe).toBeNull();
  });
});

describe('frequency', () => {
  it('counts sessions, not sets', () => {
    const stats = build([
      set({ weeksAgo: 1 }),
      set({ weeksAgo: 1, setNumber: 2 }),
      set({ weeksAgo: 2 }),
    ]);
    expect(stats?.sessions).toBe(2);
    expect(stats?.totalSets).toBe(3);
    expect(stats?.sessionsPerWeek).toBe(0.3);
  });
});
