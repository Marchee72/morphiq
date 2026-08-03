import { describe, expect, it } from 'vitest';
import type { Measurement } from '../../../core/entities/Measurement';
import type { UserProfile } from '../../../core/entities/UserProfile';
import { MS_PER_DAY } from '../buckets';
import type { MetricKey } from '../../types';
import { buildBody, buildMetricPoint, buildSeries, HEALTH_IMPORT_DAYS, isImproving, isMeasured, METRIC_SPECS, metricByKey, SERIES_WEEKS, valueNear } from '../bodyMetrics';

const NOW = new Date(2026, 6, 27, 12);

/** The reader a spec uses, by key — the tests exercise metrics through their spec. */
const readerFor = (key: MetricKey) => METRIC_SPECS.find(s => s.key === key)!.read;
const weightOf = readerFor('weight');

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
  it('covers every displayed metric in a stable order', () => {
    expect(METRIC_SPECS.map(s => s.key)).toEqual([
      'weight', 'bodyFat', 'muscleMass', 'muscleMassPct', 'bmi', 'bodyWater',
      'visceralFat', 'bmr', 'metabolicAge', 'protein',
    ]);
  });

  it('reads muscle mass percent off weight and muscle mass', () => {
    expect(readerFor('muscleMassPct')(measurement(0, { muscleMass: 35, weight: 70 }))).toBe(50);
  });

  it('reports muscle mass percent as absent when either operand is missing', () => {
    // `addManualMeasurement` zeroes every BIA field, so both of these are real
    // rows. A ratio here would either divide by zero or invent a measured 0 %,
    // and zero is what the rest of this file reads as "no reading".
    const read = readerFor('muscleMassPct');
    expect(read(measurement(0, { muscleMass: 0 }))).toBe(0);
    expect(read(measurement(0, { weight: 0 }))).toBe(0);
  });

  it('marks only what a scale actually weighs as measured', () => {
    // Metabolic age and BMR come out of BiaCalculator against a hardcoded
    // impedance; the detail sheet must not present them as readings.
    expect(isMeasured('bodyFat')).toBe(true);
    expect(isMeasured('muscleMassPct')).toBe(true);
    expect(isMeasured('metabolicAge')).toBe(false);
    expect(isMeasured('bmr')).toBe(false);
  });
});

describe('HEALTH_IMPORT_DAYS', () => {
  it('reaches back at least as far as the charts are drawn', () => {
    // A shorter import window leaves the left of every chart filled by
    // `fillGaps` over readings Health Connect already holds.
    expect(HEALTH_IMPORT_DAYS).toBeGreaterThanOrEqual(SERIES_WEEKS * 7);
  });
});

describe('buildSeries', () => {
  it('produces twelve points from sparse readings', () => {
    const series = buildSeries([measurement(60, { weight: 84 }), measurement(1, { weight: 80 })], weightOf, NOW);
    expect(series).toHaveLength(12);
    expect(series!.at(-1)).toBe(80);
  });

  it('averages within a week rather than taking the last reading', () => {
    // BIA is noisy enough that a mean is the honest summary of a week.
    const series = buildSeries(
      [measurement(3, { weight: 80 }), measurement(2, { weight: 82 })],
      weightOf,
      NOW,
    );
    expect(series!.at(-1)).toBe(81);
  });

  it('returns null when nothing is plottable', () => {
    expect(buildSeries([], weightOf, NOW)).toBeNull();
    // Zeroed fields are what `addManualMeasurement` writes for everything but weight.
    expect(buildSeries([measurement(1, { bodyFat: 0 })], readerFor('bodyFat'), NOW)).toBeNull();
  });

  it('plots a derived metric the same way as a stored one', () => {
    const series = buildSeries([measurement(1, { muscleMass: 35, weight: 70 })], readerFor('muscleMassPct'), NOW);
    expect(series!.at(-1)).toBe(50);
  });
});

describe('valueNear', () => {
  it('finds the closest reading inside the tolerance', () => {
    const sorted = [measurement(33, { weight: 84 }), measurement(28, { weight: 83 })];
    expect(valueNear(sorted, weightOf, new Date(NOW.getTime() - 30 * MS_PER_DAY))).toBe(83);
  });

  it('breaks an exact tie toward the more recent reading', () => {
    const sorted = [measurement(32, { weight: 84 }), measurement(28, { weight: 83 })];
    expect(valueNear(sorted, weightOf, new Date(NOW.getTime() - 30 * MS_PER_DAY))).toBe(83);
  });

  it('returns null when the window is empty', () => {
    const sorted = [measurement(1, { weight: 80 })];
    expect(valueNear(sorted, weightOf, new Date(NOW.getTime() - 30 * MS_PER_DAY))).toBeNull();
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
  it('reports no data for an empty history but still returns every metric', () => {
    const body = buildBody([], null, NOW);
    expect(body.hasData).toBe(false);
    expect(body.metrics).toHaveLength(METRIC_SPECS.length);
    expect(body.latestAt).toBeNull();
  });

  it('summarises a real history', () => {
    const body = buildBody([measurement(40, { weight: 84 }), measurement(2, { weight: 80 })], null, NOW);
    expect(body.hasData).toBe(true);
    expect(body.readingCount).toBe(2);
    expect(metricByKey(body.metrics, 'weight')!.value).toBe(80);
  });

  it('carries BMI and muscle percent through to the view model', () => {
    const body = buildBody([measurement(1, { bmi: 23.4, muscleMass: 35, weight: 70 })], null, NOW);
    expect(metricByKey(body.metrics, 'bmi')!.value).toBe(23.4);
    expect(metricByKey(body.metrics, 'muscleMassPct')!.value).toBe(50);
  });

  it('leaves the derived metrics at zero for a manual weigh-in', () => {
    // What `addManualMeasurement` writes: a weight, a derived BMI, BIA zeroed.
    // The Body screen filters on `value > 0`, so this is what hides them.
    const manual = measurement(1, {
      weight: 80, bmi: 25.3, bodyFat: 0, muscleMass: 0, bodyWater: 0,
      visceralFat: 0, metabolicAge: 0, protein: 0,
    });
    const body = buildBody([manual], null, NOW);
    expect(metricByKey(body.metrics, 'muscleMassPct')!.value).toBe(0);
    expect(metricByKey(body.metrics, 'muscleMassPct')!.series).toBeNull();
    expect(metricByKey(body.metrics, 'bmi')!.value).toBe(25.3);
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
