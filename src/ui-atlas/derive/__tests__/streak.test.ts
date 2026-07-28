import { describe, expect, it } from 'vitest';
import type { WorkoutLog } from '../../../core/entities/WorkoutLog';
import { bestStreak, buildStreak, buildWeek, currentStreak, trainingDays, DEFAULT_WEEKLY_GOAL_DAYS } from '../streak';

const NOW = new Date(2026, 6, 27, 18); // Monday 27 July 2026, evening
const DAY = 86_400_000;

const log = (daysAgo: number): WorkoutLog => ({
  profileId: 'p1',
  timestamp: new Date(NOW.getTime() - daysAgo * DAY),
  type: 'Strength Training',
  duration: 60,
  description: '',
});

const daysFrom = (offsets: number[]) => trainingDays(offsets.map(log));

describe('currentStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(currentStreak(daysFrom([0, 1, 2]), NOW)).toBe(3);
  });

  it('survives a day that has not been trained yet', () => {
    // Anchoring strictly to today would reset the streak at midnight, before the
    // user has had any chance to train — reading as lost progress they still have.
    expect(currentStreak(daysFrom([1, 2, 3]), NOW)).toBe(3);
  });

  it('is zero once two days have passed', () => {
    expect(currentStreak(daysFrom([2, 3, 4]), NOW)).toBe(0);
  });

  it('stops at the first gap', () => {
    expect(currentStreak(daysFrom([0, 1, 3, 4]), NOW)).toBe(2);
  });

  it('is zero with no history', () => {
    expect(currentStreak(new Set(), NOW)).toBe(0);
  });
});

describe('bestStreak', () => {
  it('finds the longest run anywhere in the window', () => {
    expect(bestStreak(daysFrom([0, 1, 10, 11, 12, 13, 20]))).toBe(4);
  });

  it('counts a lone day as one', () => {
    expect(bestStreak(daysFrom([5]))).toBe(1);
  });

  it('is zero with no history', () => {
    expect(bestStreak(new Set())).toBe(0);
  });

  it('counts several logs on one day once', () => {
    expect(bestStreak(daysFrom([3, 3, 3]))).toBe(1);
  });
});

describe('buildWeek', () => {
  it('returns seven Monday-start cells', () => {
    const week = buildWeek(new Set(), NOW);
    expect(week).toHaveLength(7);
    expect(week[0].date.getDay()).toBe(1);
    expect(week[6].date.getDay()).toBe(0); // Sunday closes the week
  });

  it('marks today exactly once', () => {
    expect(buildWeek(new Set(), NOW).filter(d => d.isToday)).toHaveLength(1);
  });

  it('marks trained days from real logs, not from position', () => {
    // Replaces the showcase's hardcoded `i < 3` rings.
    const week = buildWeek(daysFrom([0]), NOW);
    expect(week[0].done).toBe(true); // Monday is today
    expect(week.filter(d => d.done)).toHaveLength(1);
  });
});

describe('buildStreak', () => {
  it('assembles the full view model', () => {
    const streak = buildStreak([log(0), log(1)], 5, NOW);
    expect(streak.current).toBe(2);
    expect(streak.best).toBe(2);
    expect(streak.weekGoal).toBe(5);
    // Sunday the 26th belongs to last week, so only today counts toward this one.
    expect(streak.weekDone).toBe(1);
  });

  it('falls back to the default goal when the profile has none', () => {
    expect(buildStreak([], undefined, NOW).weekGoal).toBe(DEFAULT_WEEKLY_GOAL_DAYS);
    expect(buildStreak([], 0, NOW).weekGoal).toBe(DEFAULT_WEEKLY_GOAL_DAYS);
  });
});
