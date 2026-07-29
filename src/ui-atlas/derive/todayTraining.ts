import type { HistoryEntryVM, MuscleLoadRow, TodayTrainingVM } from '../types';
import { dayKey, startOfDay, MS_PER_DAY } from './buckets';
import { normalizeName } from './records';

/**
 * "Have I trained today, and what was it."
 *
 * Today's screen had a live-session hero and a week strip, which together
 * answer neither question once the session is over: the hero goes back to
 * "start a session" the moment you finish one, and a filled ring says a day
 * happened without saying what was in it. This is the fold-level answer, and
 * when it is "not yet" it carries what you last did instead — which is what
 * decides what you train today.
 */
export function buildTodayTraining(history: HistoryEntryVM[], now: Date): TodayTrainingVM {
  const key = dayKey(now);
  const today = history.filter(entry => dayKey(entry.at) === key);
  const previous = history.find(entry => entry.at.getTime() < startOfDay(now).getTime()) ?? null;

  const exercises = new Map<string, string>();
  for (const entry of today) {
    for (const name of entry.exercises) {
      const id = normalizeName(name);
      if (id && !exercises.has(id)) exercises.set(id, name);
    }
  }

  return {
    sessions: today,
    exercises: [...exercises.values()],
    sets: today.reduce((total, entry) => total + entry.sets, 0),
    volumeKg: today.reduce((total, entry) => total + entry.volumeKg, 0),
    minutes: today.reduce((total, entry) => total + entry.durationMin, 0),
    prs: today.reduce((total, entry) => total + entry.prs, 0),
    previous,
    daysSincePrevious: previous
      ? Math.round((startOfDay(now).getTime() - startOfDay(previous.at).getTime()) / MS_PER_DAY)
      : null,
  };
}

/**
 * The group most worth training next: furthest behind its weekly set target,
 * and rested enough to be trained.
 *
 * Debt first, recovery as the tie-break rather than the other way round — a
 * fully recovered group you have already hit sixteen times this week is not the
 * one to train. A group that is both behind and still sore loses to an equally
 * behind group that is not, which is exactly the trade a person makes.
 *
 * Null when every group is at or past target, because at that point the honest
 * answer is "nothing is behind", not a lowest-of-six pick dressed up as advice.
 */
export function nextMuscleFocus(rows: MuscleLoadRow[]): MuscleLoadRow | null {
  const behind = rows.filter(row => row.target > 0 && row.sets < row.target);
  if (behind.length === 0) return null;

  return [...behind].sort((a, b) =>
    (a.sets / a.target) - (b.sets / b.target)
    || b.recoveredPct - a.recoveredPct)[0];
}
