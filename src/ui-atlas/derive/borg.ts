import type { WorkoutSet } from '../../core/entities/WorkoutSet';
import type { StaticKey } from '../../i18n/types';
import { isCountedSet } from './muscleLoad';

/**
 * Perceived exertion on the Borg 6-20 scale.
 *
 * The app could say what you lifted and never what it cost, so 80×8 easy and
 * 80×8 to failure were the same row — which is exactly the distinction that
 * decides whether to add weight next time.
 *
 * The scale runs 6-20 rather than 0-10 because that is the original Borg, whose
 * numbers were chosen to track heart rate: roughly bpm ÷ 10 for a healthy
 * adult. It is asked once per exercise and written to every completed set of
 * that exercise, because there is no row between session and set to hang it on.
 */

export const BORG_MIN = 6;
export const BORG_MAX = 20;

export const BORG_VALUES: readonly number[] = Array.from(
  { length: BORG_MAX - BORG_MIN + 1 },
  (_, i) => BORG_MIN + i,
);

/**
 * The five offered without opening anything.
 *
 * Odd numbers because those are the anchors Borg actually labelled — the even
 * ones exist so you can sit between two descriptions, which is a refinement,
 * not a first answer.
 */
export const BORG_QUICK: readonly number[] = [11, 13, 15, 17, 19];

export function isValidBorg(value: unknown): value is number {
  return (
    typeof value === 'number'
    && Number.isInteger(value)
    && value >= BORG_MIN
    && value <= BORG_MAX
  );
}

/**
 * Seven descriptions across fifteen numbers, highest threshold first.
 *
 * One key per value would be fifteen strings in two languages saying the same
 * six things — and Borg's own scale only ever labelled the odd rungs.
 */
const ANCHORS: readonly { from: number; key: StaticKey }[] = [
  { from: 19, key: 'borg.maximal' },
  { from: 17, key: 'borg.veryHard' },
  { from: 15, key: 'borg.hard' },
  { from: 12, key: 'borg.somewhatHard' },
  { from: 10, key: 'borg.light' },
  { from: 7, key: 'borg.veryLight' },
  { from: BORG_MIN, key: 'borg.noExertion' },
];

/** The description for a rating. Values outside the scale clamp to its ends. */
export function borgLabelKey(rpe: number): StaticKey {
  return ANCHORS.find(anchor => rpe >= anchor.from)?.key ?? 'borg.noExertion';
}

/**
 * The rating for one exercise: the first one its sets carry.
 *
 * Any of them would do — the answer is written to every completed set at once —
 * so "first" is a way of saying "the exercise's", not a choice between rivals.
 * A set added after the exercise was closed carries none, and is skipped rather
 * than treated as a zero.
 */
export function exerciseRpe(sets: readonly { rpe?: number }[]): number | null {
  for (const set of sets) {
    if (isValidBorg(set.rpe)) return set.rpe;
  }
  return null;
}

export interface SessionRpeVM {
  /** Mean across every rated set. Null when nothing was rated — never 0. */
  avg: number | null;
  max: number | null;
}

/**
 * Weighted so that an exercise counts for as many sets as it has.
 *
 * Because one answer is stamped onto every set of its exercise, averaging over
 * sets makes five hard sets outweigh two hard sets — which is the intent: more
 * of the session was hard. Averaging over exercises instead would let one
 * throwaway finisher drag down a session of heavy compounds. Not a bug.
 */
function aggregate(ratings: readonly { rpe: number; weight: number }[]): SessionRpeVM {
  let total = 0;
  let weight = 0;
  let max: number | null = null;

  for (const rating of ratings) {
    if (rating.weight <= 0) continue;
    total += rating.rpe * rating.weight;
    weight += rating.weight;
    if (max === null || rating.rpe > max) max = rating.rpe;
  }

  return { avg: weight > 0 ? +(total / weight).toFixed(1) : null, max };
}

/** Session exertion from written history — one sample per performed, rated set. */
export function sessionRpe(sets: readonly WorkoutSet[]): SessionRpeVM {
  return aggregate(
    sets
      .filter(set => isCountedSet(set) && isValidBorg(set.rpe))
      .map(set => ({ rpe: set.rpe as number, weight: 1 })),
  );
}

/**
 * The same figure mid-session, where the rating lives on the exercise.
 *
 * The live view models carry no per-set rating — asking once per exercise means
 * a set has no answer of its own to show — so the exercise's rating is weighted
 * by how many of its sets are done.
 */
export function sessionRpeFromExercises(
  exercises: readonly { rpe?: number; sets: readonly { done: boolean }[] }[],
): SessionRpeVM {
  return aggregate(
    exercises
      .filter(exercise => isValidBorg(exercise.rpe))
      .map(exercise => ({
        rpe: exercise.rpe as number,
        weight: exercise.sets.filter(set => set.done).length,
      })),
  );
}

/**
 * Session load: exertion × minutes.
 *
 * **This is not Foster's sRPE.** That method is defined on the CR10 scale, where
 * the product has a published meaning and comparable reference values. On Borg
 * 6-20 the same multiplication yields a number in arbitrary units: it is
 * comparable to your own past sessions and to nothing else. Read as a trend, not
 * as a measurement, and do not compare it to TRIMP or to figures from a paper.
 */
export function trainingLoad(avgRpe: number | null, minutes: number): number | null {
  if (avgRpe === null || !(minutes > 0)) return null;
  return Math.round(avgRpe * minutes);
}
