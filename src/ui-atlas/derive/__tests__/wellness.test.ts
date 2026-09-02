import { describe, expect, it } from 'vitest';
import type { WellnessLog } from '../../../core/entities/WellnessLog';
import {
  buildWellnessToday, buildWellnessTrend, isAnswered,
  readinessScore, restingHrBaseline, SLEEP_TARGET_MINUTES, WELLNESS_ITEMS,
} from '../wellness';

const NOW = new Date(2026, 6, 27, 18, 30);
const DAY = 86_400_000;

/** `YYYY-MM-DD` for a day offset from NOW. */
function day(daysAgo = 0): string {
  const d = new Date(NOW.getTime() - daysAgo * DAY);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
}

function log(over: Partial<WellnessLog> & { daysAgo?: number } = {}): WellnessLog {
  const { daysAgo = 0, ...rest } = over;
  return {
    profileId: 'p1',
    day: day(daysAgo),
    timestamp: new Date(NOW.getTime() - daysAgo * DAY),
    ...rest,
  };
}

describe('the scales', () => {
  it('keeps every item pointing the same way', () => {
    // Higher is better throughout — including soreness and stress, where the
    // natural phrasing runs the other way. This is the test that catches an
    // inverted field, because a flipped sign still produces a plausible score.
    expect(WELLNESS_ITEMS.map(i => i.key)).toEqual(['energy', 'soreness', 'stress', 'mood']);

    const wrecked = readinessScore(log({ energy: 1, soreness: 1, stress: 1, mood: 1 }));
    const fresh = readinessScore(log({ energy: 5, soreness: 5, stress: 5, mood: 5 }));
    expect(wrecked).toBe(0);
    expect(fresh).toBe(100);

    // Moving soreness or stress up alone must raise the score, not lower it.
    const base = readinessScore(log({ energy: 3, soreness: 1, stress: 1, mood: 3 })) as number;
    expect(readinessScore(log({ energy: 3, soreness: 5, stress: 1, mood: 3 })) as number).toBeGreaterThan(base);
    expect(readinessScore(log({ energy: 3, soreness: 1, stress: 5, mood: 3 })) as number).toBeGreaterThan(base);
  });
});

describe('readinessScore', () => {
  it('is null, not zero, when the day says nothing', () => {
    expect(readinessScore(null)).toBeNull();
    expect(readinessScore(log())).toBeNull();
    // An unanswered day is not a day you were unfit to train.
    expect(readinessScore(log({ notes: 'busy' }))).toBeNull();
  });

  it('renormalises over the components that are present', () => {
    // Four perfect answers and no watch data still score 100, rather than being
    // capped by the weight reserved for sleep and heart rate.
    expect(readinessScore(log({ energy: 5, soreness: 5, stress: 5, mood: 5 }))).toBe(100);
    // One answer alone is enough to produce a score.
    expect(readinessScore(log({ energy: 5 }))).toBe(100);
    expect(readinessScore(log({ energy: 1 }))).toBe(0);
  });

  it('folds sleep in against the target', () => {
    const short = readinessScore(log({ energy: 5, sleepMinutes: SLEEP_TARGET_MINUTES / 2 })) as number;
    const full = readinessScore(log({ energy: 5, sleepMinutes: SLEEP_TARGET_MINUTES })) as number;
    expect(full).toBe(100);
    expect(short).toBeLessThan(full);
    // Sleeping past the target does not push the score above full.
    expect(readinessScore(log({ energy: 5, sleepMinutes: SLEEP_TARGET_MINUTES * 2 }))).toBe(100);
  });

  it('ignores resting heart rate when there is no baseline to judge it against', () => {
    // An absolute bpm says nothing on its own, so it must not move the score.
    const withHr = readinessScore(log({ energy: 3, restingHr: 70 }), null);
    const without = readinessScore(log({ energy: 3 }), null);
    expect(withHr).toBe(without);
  });

  it('penalises a resting heart rate above your own baseline', () => {
    const normal = readinessScore(log({ energy: 5, restingHr: 52 }), 52) as number;
    const elevated = readinessScore(log({ energy: 5, restingHr: 62 }), 52) as number;
    expect(normal).toBe(100);
    expect(elevated).toBeLessThan(normal);
  });
});

describe('restingHrBaseline', () => {
  it('excludes the day being judged', () => {
    // Including it would pull the baseline toward the reading and flatten the
    // very deviation being looked for.
    const logs = [
      log({ daysAgo: 3, restingHr: 50 }),
      log({ daysAgo: 2, restingHr: 50 }),
      log({ daysAgo: 1, restingHr: 50 }),
      log({ daysAgo: 0, restingHr: 90 }),
    ];
    expect(restingHrBaseline(logs, day(0))).toBe(50);
  });

  it('needs a few days before it means anything', () => {
    expect(restingHrBaseline([log({ daysAgo: 1, restingHr: 50 })], day(0))).toBeNull();
    expect(restingHrBaseline([], day(0))).toBeNull();
  });

  it('skips days with no reading', () => {
    const logs = [
      log({ daysAgo: 4, restingHr: 50 }),
      log({ daysAgo: 3 }),
      log({ daysAgo: 2, restingHr: 52 }),
      log({ daysAgo: 1, restingHr: 54 }),
    ];
    expect(restingHrBaseline(logs, day(0))).toBe(52);
  });
});

describe('isAnswered', () => {
  it('is about the four scales, not about the watch', () => {
    // A day the watch filled in is not a day you answered.
    expect(isAnswered(log({ sleepMinutes: 420, restingHr: 52 }))).toBe(false);
    expect(isAnswered(log({ energy: 3 }))).toBe(true);
    expect(isAnswered(null)).toBe(false);
  });
});

describe('buildWellnessToday', () => {
  it('finds today and scores it against the days before', () => {
    const vm = buildWellnessToday([
      log({ daysAgo: 3, restingHr: 50 }),
      log({ daysAgo: 2, restingHr: 50 }),
      log({ daysAgo: 1, restingHr: 50 }),
      log({ daysAgo: 0, energy: 4, soreness: 4, stress: 4, mood: 4, restingHr: 56 }),
    ], NOW);

    expect(vm.day).toBe(day(0));
    expect(vm.answered).toBe(true);
    expect(vm.restingHrDelta).toBe(6);
    expect(vm.readiness).not.toBeNull();
  });

  it('reports an unanswered day without inventing a score', () => {
    const vm = buildWellnessToday([log({ daysAgo: 1, energy: 5 })], NOW);
    expect(vm.log).toBeNull();
    expect(vm.answered).toBe(false);
    expect(vm.readiness).toBeNull();
    expect(vm.restingHrDelta).toBeNull();
  });
});

describe('buildWellnessTrend', () => {
  it('produces one series per item plus readiness and sleep', () => {
    const trend = buildWellnessTrend([
      log({ daysAgo: 20, energy: 2, soreness: 2, stress: 2, mood: 2, sleepMinutes: 360 }),
      log({ daysAgo: 1, energy: 5, soreness: 5, stress: 5, mood: 5, sleepMinutes: 480 }),
    ], NOW);

    expect(trend.weeks).toBe(12);
    expect(trend.readinessSeries).toHaveLength(12);
    expect(trend.sleepSeries?.at(-1)).toBe(8);
    expect(trend.itemSeries.map(i => i.key)).toEqual(['energy', 'soreness', 'stress', 'mood']);
    expect(trend.itemSeries[0].series?.at(-1)).toBe(5);
  });

  it('leaves a series null rather than flat when nothing was recorded', () => {
    const trend = buildWellnessTrend([log({ daysAgo: 1, energy: 4 })], NOW);
    expect(trend.itemSeries.find(i => i.key === 'energy')?.series).not.toBeNull();
    // Nothing ever answered stress, so its chart has nothing to draw.
    expect(trend.itemSeries.find(i => i.key === 'stress')?.series).toBeNull();
    expect(trend.sleepSeries).toBeNull();
  });

  it('buckets by the day it is about, not by when it was answered', () => {
    // Answered the next morning — the day is what the entry describes.
    const trend = buildWellnessTrend([
      { ...log({ daysAgo: 1, energy: 5 }), timestamp: NOW },
    ], NOW);
    expect(trend.itemSeries[0].series?.at(-1)).toBe(5);
  });
});
