import { describe, expect, it } from 'vitest';
import type { WorkoutLog } from '../../../core/entities/WorkoutLog';
import type { WorkoutSet } from '../../../core/entities/WorkoutSet';
import { buildCardio, buildHistory, buildWeeklyStats, buildWeeklyVolume, totalVolume } from '../history';

const NOW = new Date(2026, 6, 27, 12);
const DAY = 86_400_000;

const log = (id: string, daysAgo: number, over: Partial<WorkoutLog> = {}): WorkoutLog => ({
  id, profileId: 'p1', timestamp: new Date(NOW.getTime() - daysAgo * DAY),
  type: 'Push Day', duration: 62, description: '', caloriesBurned: 400, ...over,
});

const set = (id: string, over: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id, workoutLogId: 'w1', profileId: 'p1', exerciseName: 'Bench Press',
  setNumber: 1, weight: 60, reps: 10, isCompleted: true, timestamp: NOW, ...over,
});

describe('totalVolume', () => {
  it('multiplies load by reps over completed sets', () => {
    expect(totalVolume([set('a'), set('b', { weight: 80, reps: 5 })])).toBe(1000);
  });

  it('ignores unfinished sets', () => {
    expect(totalVolume([set('a', { isCompleted: false })])).toBe(0);
  });

  it('is zero for bodyweight work rather than NaN', () => {
    expect(totalVolume([set('a', { weight: undefined })])).toBe(0);
  });
});

describe('buildCardio', () => {
  const run = (over: Partial<WorkoutLog> = {}) => log('w1', 0, {
    type: 'Running', duration: 32, distanceKm: 6.4,
    avgHeartRate: 152, maxHeartRate: 171, steps: 5840, source: 'health-connect', ...over,
  });

  it('carries the activity numbers of a session with no sets', () => {
    expect(buildCardio(run(), 0)).toEqual({
      readout: 'pace',
      distanceKm: 6.4,
      calories: 400,
      avgHeartRate: 152,
      maxHeartRate: 171,
      steps: 5840,
    });
  });

  it('reads a ride as a speed', () => {
    expect(buildCardio(run({ type: 'Cycling' }), 0)?.readout).toBe('speed');
  });

  it('yields nothing when the session has logged sets — those are the point', () => {
    // A gym session whose calories the watch also recorded is still a gym
    // session; cardio tiles would bury the sets.
    expect(buildCardio(run(), 12)).toBeUndefined();
  });

  it('yields nothing when there are no activity numbers to show', () => {
    const bare = log('w1', 0, {
      type: 'Yoga', caloriesBurned: undefined, distanceKm: undefined,
      avgHeartRate: undefined, steps: undefined,
    });
    expect(buildCardio(bare, 0)).toBeUndefined();
  });

  it('drops a zero rather than showing an empty tile', () => {
    // Health Connect sent no calories for a real 6.56 km run, and the import
    // stores `w.calories || 0` — which surfaced as a "0 kcal" tile on the phone.
    const noCalories = buildCardio(run({ caloriesBurned: 0 }), 0);
    expect(noCalories?.calories).toBeUndefined();
    expect(noCalories?.distanceKm).toBe(6.4);

    const noHr = buildCardio(run({ avgHeartRate: 0, maxHeartRate: 0, steps: 0 }), 0);
    expect(noHr?.avgHeartRate).toBeUndefined();
    expect(noHr?.steps).toBeUndefined();
  });

  it('yields nothing when every number is zero', () => {
    const empty = run({
      distanceKm: 0, caloriesBurned: 0, avgHeartRate: 0, maxHeartRate: 0, steps: 0,
    });
    expect(buildCardio(empty, 0)).toBeUndefined();
  });

  it('keeps a distance-less activity that still burned calories', () => {
    const yoga = log('w1', 0, { type: 'Yoga', caloriesBurned: 180 });
    expect(buildCardio(yoga, 0)).toMatchObject({ readout: null, calories: 180 });
  });
});

describe('buildHistory', () => {
  const setsByLog = { w1: [set('a'), set('b', { weight: 80, reps: 5 })] };

  it('marks a synced run as an activity, and a lifted session as not', () => {
    const entries = buildHistory(
      [log('w1', 1), log('w2', 2, { type: 'Running', distanceKm: 6.4, source: 'health-connect' })],
      setsByLog,
    );
    const byId = Object.fromEntries(entries.map(e => [e.id, e]));
    expect(byId.w1.cardio).toBeUndefined();
    expect(byId.w2.cardio).toMatchObject({ readout: 'pace', distanceKm: 6.4 });
    // The run still reports zero sets and zero volume — it just no longer
    // depends on those being read as the headline.
    expect(byId.w2.sets).toBe(0);
  });

  it('returns sessions newest first', () => {
    const entries = buildHistory([log('w1', 5), log('w2', 1)], {});
    expect(entries.map(e => e.id)).toEqual(['w2', 'w1']);
  });

  it('summarises volume and set count from the logged sets', () => {
    const [entry] = buildHistory([log('w1', 1)], setsByLog);
    expect(entry.volumeKg).toBe(1000);
    expect(entry.sets).toBe(2);
    expect(entry.durationMin).toBe(62);
  });

  it('counts the PRs a session earned at the time', () => {
    const [entry] = buildHistory([log('w1', 1)], setsByLog, new Set(['b']));
    expect(entry.prs).toBe(1);
  });

  it('carries the feeling tag through', () => {
    const [entry] = buildHistory([log('w1', 1, { feelingTag: 'sore' })], {});
    expect(entry.feeling).toBe('sore');
  });

  it('handles a session whose sets were never loaded', () => {
    const [entry] = buildHistory([log('w1', 1)], {});
    expect(entry.volumeKg).toBe(0);
    expect(entry.sets).toBe(0);
  });
});

describe('buildWeeklyVolume', () => {
  it('returns twelve zero-filled weeks, since a rest week is real information', () => {
    const series = buildWeeklyVolume([log('w1', 1)], { w1: [set('a')] }, NOW);
    expect(series).toHaveLength(12);
    expect(series.at(-1)).toBe(600);
    expect(series[0]).toBe(0);
  });
});

describe('buildWeeklyStats', () => {
  it('covers the last seven days only', () => {
    const logs = [log('w1', 1), log('w2', 3), log('w3', 20)];
    const stats = buildWeeklyStats(logs, { w1: [set('a')] }, NOW);
    expect(stats.workouts).toBe(2);
    expect(stats.minutes).toBe(124);
    expect(stats.calories).toBe(800);
    expect(stats.volumeKg).toBe(600);
  });

  it('is all zeros with no recent training', () => {
    expect(buildWeeklyStats([log('w1', 30)], {}, NOW)).toEqual({
      workouts: 0, minutes: 0, calories: 0, volumeKg: 0,
    });
  });
});
