import type { HistoryEntryVM, MuscleLoadRow, TodayTrainingVM } from '../types';
import { dayKey, hoursBetween, startOfDay, MS_PER_DAY } from './buckets';
import { normalizeName } from './records';
import { RECOVERY_HOURS } from './muscleLoad';

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

/**
 * The groups that are rested enough to train — never trained, or past their
 * recovery window. Sorted by longest rest first, capped at two so the nudge
 * line stays a line, not a paragraph.
 */
export function freshGroups(rows: MuscleLoadRow[], now: Date): MuscleLoadRow[] {
  return rows
    .filter(row => {
      if (!row.lastHitAt) return true;
      return hoursBetween(row.lastHitAt, now) >= RECOVERY_HOURS[row.group];
    })
    .sort((a, b) => {
      const aHours = a.lastHitAt ? hoursBetween(a.lastHitAt, now) : Infinity;
      const bHours = b.lastHitAt ? hoursBetween(b.lastHitAt, now) : Infinity;
      return bHours - aHours;
    })
    .slice(0, 2);
}

export interface GoalNudgeInput {
  weekDone: number;
  weekGoal: number;
  trainedToday: boolean;
}

export type GoalNudgeState =
  | { kind: 'goalFresh' }
  | { kind: 'goalMetFresh' }
  | { kind: 'goalHit' }
  | { kind: 'goalRemaining'; remaining: number };

/**
 * The context-aware nudge under the goal/streak line. Four states, because the
 * goal and whether you have already trained today are independent — hitting 4/4
 * before training today is not the same as hitting it after.
 */
export function goalNudge(input: GoalNudgeInput, _fresh: MuscleLoadRow[]): GoalNudgeState {
  const { weekDone, weekGoal, trainedToday } = input;
  const met = weekDone >= weekGoal;

  if (!trainedToday && !met) return { kind: 'goalFresh' };
  if (!trainedToday && met) return { kind: 'goalMetFresh' };
  if (trainedToday && met) return { kind: 'goalHit' };
  return { kind: 'goalRemaining', remaining: weekGoal - weekDone };
}
