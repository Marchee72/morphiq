import { describe, expect, it } from 'vitest';
import type { Measurement } from '../../../core/entities/Measurement';
import type { UserProfile } from '../../../core/entities/UserProfile';
import { MS_PER_DAY } from '../buckets';
import { buildBody, buildMetricPoint, buildSeries, isImproving, METRIC_SPECS, metricByKey, valueNear } from '../bodyMetrics';

const NOW = new Date(2026, 6, 27, 12);

function measurement(daysAgo: number, over: Partial<Measurement> = {}): Measurement {
  return {
    profileId: 'p1',
    timestamp: new Date(NOW.getTime() - daysAgo * MS_PER_DAY),
    weight: 80, impedance: 500, bmi: 24, bmr: 1700, bodyFat: 20, bodyWater: 55,
    boneMass: 3, muscleMass: 60, visceralFat: 8, metabolicAge: 30, protein: 17, bodyType: 3,
    ...over,
  };
}

const profile = (over: Partial<UserProfile> = {}): UserProfile => ({
  name: 'Marc', gender: 'male', birthDate: new Date(1990, 0, 1), height: 178,
  createdAt: new Date(2020, 0, 1), ...over,
});

describe('METRIC_SPECS', () => {
  it('covers all eight BIA fields in a stable order', () => {
    expect(METRIC_SPECS.map(s => s.key)).toEqual([
      'weight', 'bodyFat', 'muscleMass', 'bodyWater',
      'visceralFat', 'bmr', 'metabolicAge', 'protein',
    ]);
  });
});

describe('buildSeries', () => {
  it('produces twelve points from sparse readings', () => {
    const series = buildSeries([measurement(60, { weight: 84 }), measurement(1, { weight: 80 })], 'weight', NOW);
    expect(series).toHaveLength(12);
    expect(series!.at(-1)).toBe(80);
  });

  it('averages within a week rather than taking the last reading', () => {
    // BIA is noisy enough that a mean is the honest summary of a week.
    const series = buildSeries(
      [measurement(3, { weight: 80 }), measurement(2, { weight: 82 })],
      'weight',
      NOW,
    );
    expect(series!.at(-1)).toBe(81);
  });

  it('returns null when nothing is plottable', () => {
    expect(buildSeries([], 'weight', NOW)).toBeNull();
    // Zeroed fields are what `addManualMeasurement` writes for everything but weight.
    expect(buildSeries([measurement(1, { bodyFat: 0 })], 'bodyFat', NOW)).toBeNull();
  });
});

describe('valueNear', () => {
  it('finds the closest reading inside the tolerance', () => {
    const sorted = [measurement(33, { weight: 84 }), measurement(28, { weight: 83 })];
    expect(valueNear(sorted, 'weight', new Date(NOW.getTime() - 30 * MS_PER_DAY))).toBe(83);
  });

  it('breaks an exact tie toward the more recent reading', () => {
    const sorted = [measurement(32, { weight: 84 }), measurement(28, { weight: 83 })];
    expect(valueNear(sorted, 'weight', new Date(NOW.getTime() - 30 * MS_PER_DAY))).toBe(83);
  });

  it('returns null when the window is empty', () => {
    const sorted = [measurement(1, { weight: 80 })];
    expect(valueNear(sorted, 'weight', new Date(NOW.getTime() - 30 * MS_PER_DAY))).toBeNull();
  });
});

describe('buildMetricPoint', () => {
  const spec = METRIC_SPECS[0];

  it('reports the latest reading, not the last bucket mean', () => {
    // The user just stepped off the scale; the number must match what it said.
    const point = buildMetricPoint([measurement(3, { weight: 80 }), measurement(0, { weight: 78.4 })], spec, null, NOW);
    expect(point.value).toBe(78.4);
  });

  it('nulls delta30d when there is no comparison reading, rather than reporting no change', () => {
    const point = buildMetricPoint([measurement(1, { weight: 80 })], spec, null, NOW);
    expect(point.delta30d).toBeNull();
  });

  it('computes delta30d against a reading in the window', () => {
    const point = buildMetricPoint([measurement(30, { weight: 82 }), measurement(0, { weight: 80 })], spec, null, NOW);
    expect(point.delta30d).toBe(-2);
  });

  it('treats losing weight as good when the target is lower', () => {
    const point = buildMetricPoint([measurement(0, { weight: 80 })], spec, profile({ targetWeight: 74 }), NOW);
    expect(point.lowerIsBetter).toBe(true);
  });

  it('treats gaining weight as good when the target is higher', () => {
    // Someone bulking must not see their progress flagged as the wrong direction.
    const point = buildMetricPoint([measurement(0, { weight: 80 })], spec, profile({ targetWeight: 86 }), NOW);
    expect(point.lowerIsBetter).toBe(false);
  });
});

describe('buildBody', () => {
  it('reports no data for an empty history but still returns all eight metrics', () => {
    const body = buildBody([], null, NOW);
    expect(body.hasData).toBe(false);
    expect(body.metrics).toHaveLength(8);
    expect(body.latestAt).toBeNull();
  });

  it('summarises a real history', () => {
    const body = buildBody([measurement(40, { weight: 84 }), measurement(2, { weight: 80 })], null, NOW);
    expect(body.hasData).toBe(true);
    expect(body.readingCount).toBe(2);
    expect(metricByKey(body.metrics, 'weight')!.value).toBe(80);
  });
});

describe('isImproving', () => {
  const point = (delta: number | null, lowerIsBetter: boolean) =>
    ({ ...buildMetricPoint([], METRIC_SPECS[0], null, NOW), delta30d: delta, lowerIsBetter });

  it('reads direction against the metric, not the sign', () => {
    expect(isImproving(point(-1, true))).toBe(true);   // body fat down
    expect(isImproving(point(-1, false))).toBe(false); // muscle mass down
    expect(isImproving(point(1, false))).toBe(true);   // muscle mass up
  });

  it('is undecided when there is no delta', () => {
    expect(isImproving(point(null, true))).toBeNull();
    expect(isImproving(point(0, true))).toBeNull();
  });
});
