import type { WorkoutLog } from '../../core/entities/WorkoutLog';
import type { DayCell, StreakVM } from '../types';
import { dayKey, startOfDay, startOfWeek, MS_PER_DAY } from './buckets';

export const DEFAULT_WEEKLY_GOAL_DAYS = 4;

/** A training day is a local calendar day carrying at least one logged workout. */
export function trainingDays(logs: WorkoutLog[]): Set<string> {
  const days = new Set<string>();
  for (const log of logs) days.add(dayKey(new Date(log.timestamp)));
  return days;
}

/**
 * Consecutive training days ending today **or yesterday**.
 *
 * Yesterday counting is deliberate: anchoring strictly to today means the streak
 * visibly resets at midnight, before the user has had any chance to train, which
 * reads as losing progress they haven't actually lost.
 */
export function currentStreak(days: Set<string>, now: Date): number {
  const today = startOfDay(now);

  let cursor = today;
  if (!days.has(dayKey(cursor))) {
    cursor = new Date(today.getTime() - MS_PER_DAY);
    if (!days.has(dayKey(cursor))) return 0;
  }

  let count = 0;
  while (days.has(dayKey(cursor))) {
    count++;
    cursor = new Date(cursor.getTime() - MS_PER_DAY);
  }
  return count;
}

/** Longest run of consecutive training days anywhere in the supplied window. */
export function bestStreak(days: Set<string>): number {
  if (days.size === 0) return 0;

  const sorted = [...days]
    .map(key => {
      const [y, m, d] = key.split('-').map(Number);
      return new Date(y, m, d).getTime();
    })
    .sort((a, b) => a - b);

  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    // Compare calendar days rather than raw ms, so DST shifts don't break a run.
    const gap = Math.round((sorted[i] - sorted[i - 1]) / MS_PER_DAY);
    run = gap === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
}

/** Seven Monday-start cells — replaces the showcase's hardcoded `i < 3` / `i === 5` rings. */
export function buildWeek(days: Set<string>, now: Date): DayCell[] {
  const monday = startOfWeek(now);
  const todayKey = dayKey(now);

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const key = dayKey(date);
    return { date, done: days.has(key), isToday: key === todayKey };
  });
}

export function buildStreak(
  logs: WorkoutLog[],
  weeklyGoalDays: number | undefined,
  now: Date,
): StreakVM {
  const days = trainingDays(logs);
  const week = buildWeek(days, now);

  return {
    current: currentStreak(days, now),
    best: bestStreak(days),
    weekDone: week.filter(d => d.done).length,
    weekGoal: weeklyGoalDays && weeklyGoalDays > 0 ? weeklyGoalDays : DEFAULT_WEEKLY_GOAL_DAYS,
    week,
  };
}
