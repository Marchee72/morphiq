import { describe, expect, it } from 'vitest';
import type { WorkoutLog } from '../../../core/entities/WorkoutLog';
import type { WorkoutSet } from '../../../core/entities/WorkoutSet';
import { buildHistory, buildWeeklyStats, buildWeeklyVolume, totalVolume } from '../history';

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

describe('buildHistory', () => {
  const setsByLog = { w1: [set('a'), set('b', { weight: 80, reps: 5 })] };

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
