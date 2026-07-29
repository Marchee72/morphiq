import type { StepsVM } from '../types';
import { dayKey, startOfDay, MS_PER_DAY } from './buckets';

/**
 * Steps, as the health source reports them.
 *
 * The source speaks `YYYY-MM-DD` strings in the phone's timezone; everything
 * above this line speaks `Date`. Converting here rather than at the render edge
 * keeps the string form — and the off-by-one-day bug it invites — in one place.
 */

/** `'2026-07-29'` → local midnight. Never `new Date(string)`, which reads UTC. */
export function fromDayString(value: string): Date | null {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function buildSteps(
  raw: { date: string; steps: number }[],
  now: Date,
  days = 7,
): StepsVM {
  const since = startOfDay(new Date(now.getTime() - (days - 1) * MS_PER_DAY)).getTime();
  const todayKey = dayKey(now);

  const recent = raw
    .map(entry => ({ date: fromDayString(entry.date), steps: Math.max(0, Math.round(entry.steps)) }))
    .filter((entry): entry is { date: Date; steps: number } => entry.date !== null)
    .filter(entry => entry.date.getTime() >= since)
    .sort((a, b) => b.date.getTime() - a.date.getTime());

  const today = recent.find(entry => dayKey(entry.date) === todayKey);

  return {
    // Null rather than 0 when the source has said nothing: "no reading" and
    // "you have not moved" look identical as a zero and are not the same fact.
    today: today ? today.steps : null,
    recent,
    // A day with no entry at all is excluded above, so an average over what is
    // there is honest about a week the phone was not carried every day.
    weeklyAvg: recent.length > 0
      ? Math.round(recent.reduce((total, entry) => total + entry.steps, 0) / recent.length)
      : null,
  };
}
