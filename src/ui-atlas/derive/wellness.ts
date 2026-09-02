import {
  WELLNESS_SCALE_MAX, WELLNESS_SCALE_MIN, wellnessDayKey, type WellnessLog,
} from '../../core/entities/WellnessLog';
import type { StaticKey } from '../../i18n/types';
import { fillGaps, meanOf, weeklyBuckets } from './buckets';

/**
 * How ready you are for the work in front of you.
 *
 * The first day-keyed data in the app, and the only place four of these numbers
 * can come from: Health Connect has no record type for stress, mood or soreness,
 * and Samsung's own scores never leave Samsung. Sleep and resting heart rate do
 * come from the watch, so they are read rather than asked.
 */

export type WellnessItemKey = 'energy' | 'soreness' | 'stress' | 'mood';

export interface WellnessItemSpec {
  key: WellnessItemKey;
  labelKey: StaticKey;
  /** What a 1 means, and what a 5 means. Higher is better throughout. */
  lowKey: StaticKey;
  highKey: StaticKey;
}

/** Fixed order: the sheet renders these top to bottom exactly as listed. */
export const WELLNESS_ITEMS: readonly WellnessItemSpec[] = [
  { key: 'energy', labelKey: 'wellness.energy', lowKey: 'wellness.energy.low', highKey: 'wellness.energy.high' },
  { key: 'soreness', labelKey: 'wellness.soreness', lowKey: 'wellness.soreness.low', highKey: 'wellness.soreness.high' },
  { key: 'stress', labelKey: 'wellness.stress', lowKey: 'wellness.stress.low', highKey: 'wellness.stress.high' },
  { key: 'mood', labelKey: 'wellness.mood', lowKey: 'wellness.mood.low', highKey: 'wellness.mood.high' },
] as const;

/** Sleep worth a full score. Below it the component scales down proportionally. */
export const SLEEP_TARGET_MINUTES = 8 * 60;

/**
 * Days of history the resting-heart-rate baseline is drawn from.
 *
 * Against your own recent average rather than a population table: a resting
 * heart rate of 58 means nothing on its own and a great deal if you normally sit
 * at 52.
 */
export const HR_BASELINE_DAYS = 14;

/** How far above baseline counts as fully elevated, in bpm. */
const HR_ELEVATED_BPM = 8;

/**
 * What each component contributes.
 *
 * The four answers carry most of it because they are the only ones that can
 * report soreness or a bad head, which is what actually moves a session. Sleep
 * is weighted like one and a half answers: it is the strongest single signal
 * here and the one most people can act on. Resting heart rate is deliberately
 * the smallest — it is a real signal, but a noisy one, and one bad night of
 * watch contact should not tell you not to train.
 *
 * Weights are renormalised over whatever is present, so a phone with no watch
 * still produces a score out of 100 rather than a permanently capped one.
 */
const WEIGHTS: Record<string, number> = {
  energy: 1, soreness: 1, stress: 1, mood: 1, sleep: 1.5, restingHr: 0.75,
};

export interface WellnessTodayVM {
  day: string;
  log: WellnessLog | null;
  /** True once any of the four scales has been answered for the day. */
  answered: boolean;
  /** 0-100, or null when nothing at all is known — never 0. */
  readiness: number | null;
  /** Resting HR against its own baseline. Null without a baseline to compare to. */
  restingHrDelta: number | null;
}

export interface WellnessTrendVM {
  weeks: number;
  readinessSeries: number[] | null;
  sleepSeries: number[] | null;
  /** One series per self-reported item, in `WELLNESS_ITEMS` order. */
  itemSeries: { key: WellnessItemKey; labelKey: StaticKey; series: number[] | null }[];
}

/** A 1-5 answer as 0-1, or null when it was not answered. */
function scaleScore(value: number | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const span = WELLNESS_SCALE_MAX - WELLNESS_SCALE_MIN;
  return Math.min(1, Math.max(0, (value - WELLNESS_SCALE_MIN) / span));
}

/**
 * Mean resting heart rate over the days before `day`.
 *
 * The day itself is excluded: comparing a reading to a baseline it is part of
 * pulls the baseline toward it and flattens exactly the deviation being looked
 * for. Null until there are at least three days to average.
 */
export function restingHrBaseline(logs: readonly WellnessLog[], day: string): number | null {
  const prior = logs
    .filter(log => log.day < day && typeof log.restingHr === 'number' && log.restingHr > 0)
    .slice(-HR_BASELINE_DAYS);
  if (prior.length < 3) return null;
  return prior.reduce((sum, log) => sum + (log.restingHr as number), 0) / prior.length;
}

/**
 * 0-100 over whatever the day actually knows.
 *
 * Null, not zero, when it knows nothing: an unanswered day is not a day you were
 * unfit to train.
 */
export function readinessScore(
  log: WellnessLog | null | undefined,
  hrBaseline: number | null = null,
): number | null {
  if (!log) return null;

  let total = 0;
  let weight = 0;
  const add = (key: string, score: number | null) => {
    if (score === null) return;
    total += score * WEIGHTS[key];
    weight += WEIGHTS[key];
  };

  for (const item of WELLNESS_ITEMS) add(item.key, scaleScore(log[item.key]));

  if (typeof log.sleepMinutes === 'number' && log.sleepMinutes > 0) {
    add('sleep', Math.min(1, log.sleepMinutes / SLEEP_TARGET_MINUTES));
  }

  // Only against a baseline. An absolute bpm says nothing without one, and
  // scoring it against a population figure would penalise anyone unusual.
  if (hrBaseline !== null && typeof log.restingHr === 'number' && log.restingHr > 0) {
    const over = log.restingHr - hrBaseline;
    add('restingHr', Math.min(1, Math.max(0, 1 - over / HR_ELEVATED_BPM)));
  }

  return weight > 0 ? Math.round((total / weight) * 100) : null;
}

/** True once any of the four scales carries an answer. */
export function isAnswered(log: WellnessLog | null | undefined): boolean {
  if (!log) return false;
  return WELLNESS_ITEMS.some(item => typeof log[item.key] === 'number');
}

export function buildWellnessToday(logs: readonly WellnessLog[], now: Date): WellnessTodayVM {
  const day = wellnessDayKey(now);
  const sorted = [...logs].sort((a, b) => a.day.localeCompare(b.day));
  const log = sorted.find(entry => entry.day === day) ?? null;
  const baseline = restingHrBaseline(sorted, day);

  return {
    day,
    log,
    answered: isAnswered(log),
    readiness: readinessScore(log, baseline),
    restingHrDelta: baseline !== null && typeof log?.restingHr === 'number'
      ? +(log.restingHr - baseline).toFixed(1)
      : null,
  };
}

export function buildWellnessTrend(
  logs: readonly WellnessLog[],
  now: Date,
  weeks = 12,
): WellnessTrendVM {
  const sorted = [...logs].sort((a, b) => a.day.localeCompare(b.day));

  // Buckets want an instant; the entity keys on a day. `timestamp` is when the
  // day was last answered, which can be the next morning — the day is what it
  // is about, so that is what it buckets by.
  const at = (log: WellnessLog): Date => {
    const [y, m, d] = log.day.split('-').map(Number);
    return new Date(y, m - 1, d, 12);
  };

  const scored = sorted.map(log => ({
    log,
    readiness: readinessScore(log, restingHrBaseline(sorted, log.day)),
  }));

  const buckets = weeklyBuckets(scored, entry => at(entry.log), now, weeks);
  const readinessSeries = fillGaps(buckets.map(bucket => meanOf(
    { ...bucket, items: bucket.items.filter(entry => entry.readiness !== null) },
    entry => entry.readiness as number,
  )));

  const rawBuckets = weeklyBuckets(sorted, at, now, weeks);
  const seriesFor = (read: (log: WellnessLog) => number | undefined) => fillGaps(
    rawBuckets.map(bucket => meanOf(
      { ...bucket, items: bucket.items.filter(log => typeof read(log) === 'number') },
      log => read(log) as number,
    )),
  );

  return {
    weeks,
    readinessSeries,
    sleepSeries: seriesFor(log => (log.sleepMinutes && log.sleepMinutes > 0 ? log.sleepMinutes / 60 : undefined)),
    itemSeries: WELLNESS_ITEMS.map(item => ({
      key: item.key,
      labelKey: item.labelKey,
      series: seriesFor(log => log[item.key]),
    })),
  };
}
