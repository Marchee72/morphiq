import type { Measurement } from '../../core/entities/Measurement';
import type { UserProfile } from '../../core/entities/UserProfile';
import type { StaticKey } from '../../i18n/types';
import type { BodyVM, MetricKey, MetricPointVM } from '../types';
import { fillGaps, meanOf, weeklyBuckets, MS_PER_DAY } from './buckets';

export const SERIES_WEEKS = 12;
const DELTA_WINDOW_DAYS = 30;
const DELTA_TOLERANCE_DAYS = 7;

/**
 * How far back the health import reaches.
 *
 * Derived from `SERIES_WEEKS` rather than picked: the charts are drawn for a
 * 12-week window, and an import window shorter than that leaves the left of
 * every chart filled by `fillGaps` over readings that exist in Health Connect
 * and were never asked for. The two must move together.
 */
export const HEALTH_IMPORT_DAYS = SERIES_WEEKS * 7;

/** Reads one number out of a reading. `0` and `NaN` both mean "not recorded". */
export type MetricRead = (m: Measurement) => number;

export interface MetricSpec {
  key: MetricKey;
  read: MetricRead;
  labelKey: StaticKey;
  unitKey: StaticKey;
  decimals: number;
  /**
   * `'goal'` means the direction depends on the user's target weight — someone
   * bulking toward a heavier target should not see "good" for losing weight.
   */
  lowerIsBetter: boolean | 'goal';
}

/** The reader for a metric that is simply a field on the entity. */
const field = (f: keyof Measurement): MetricRead => m => {
  const v = m[f];
  return typeof v === 'number' && Number.isFinite(v) ? v : NaN;
};

/**
 * Fat-free mass index: lean kilos carried per square metre of height.
 *
 * The one figure here that says how much muscle you carry *for your frame*.
 * Weight cannot — a heavier reading is muscle or fat with equal ease — and body
 * fat % cannot either, since it falls just as readily by losing lean mass as by
 * losing fat. FFMI moves only when the lean side does, which is the thing
 * training is for. Roughly 18–20 untrained, 22–23 well trained, ~25 the
 * commonly cited natural ceiling.
 *
 * Fat-free mass is `weight − fat`, deliberately, rather than the `muscleMass`
 * field: that field has bone subtracted out of it by a formula (`BiaCalculator`)
 * whose bone term is itself a straight line in lean mass, so building on it
 * would make this a second view of that line instead of a measurement. The
 * standard definition of FFM includes bone, and it is the one the published
 * reference ranges are built on.
 *
 * Height comes from the profile, so it is a closure rather than a plain field
 * reader — see `metricSpecs`.
 */
const ffmiRead = (heightCm?: number): MetricRead => m => {
  // Zero is what the rest of this file reads as "no reading". A manual weigh-in
  // stores every BIA field as 0, and a profile can have no height at all; either
  // way there is no FFMI to plot, and a 0 is not a small one.
  if (!heightCm || heightCm <= 0) return 0;
  if (!(m.weight > 0) || !(m.bodyFat > 0)) return 0;
  const heightM = heightCm / 100;
  return (m.weight * (1 - m.bodyFat / 100)) / (heightM * heightM);
};

/**
 * Fixed order: the Body screen renders these top to bottom exactly as listed.
 *
 * A function because FFMI needs the profile's height, which is not on a
 * reading. `METRIC_SPECS` below is this list without one — every spec but FFMI
 * ignores the argument, and FFMI reads as "not recorded", which is exactly what
 * a profile with no height has.
 */
export function metricSpecs(heightCm?: number): readonly MetricSpec[] {
  return [
    { key: 'weight', read: field('weight'), labelKey: 'body.metric.weight', unitKey: 'unit.kg', decimals: 1, lowerIsBetter: 'goal' },
    { key: 'bodyFat', read: field('bodyFat'), labelKey: 'body.metric.bodyFat', unitKey: 'unit.pct', decimals: 1, lowerIsBetter: true },
    { key: 'muscleMass', read: field('muscleMass'), labelKey: 'body.metric.muscleMass', unitKey: 'unit.kg', decimals: 1, lowerIsBetter: false },
    {
      key: 'muscleMassPct',
      // Zero when either operand is missing, because zero is what the rest of this
      // file reads as "no reading". Returning a ratio off a manual weigh-in — which
      // stores every BIA field as 0 — would plot a 0 % that was never measured.
      read: m => (m.muscleMass > 0 && m.weight > 0 ? (m.muscleMass / m.weight) * 100 : 0),
      labelKey: 'body.metric.muscleMassPct', unitKey: 'unit.pct', decimals: 1, lowerIsBetter: false,
    },
    { key: 'ffmi', read: ffmiRead(heightCm), labelKey: 'body.metric.ffmi', unitKey: 'unit.kgm2', decimals: 1, lowerIsBetter: false },
    { key: 'bmi', read: field('bmi'), labelKey: 'body.metric.bmi', unitKey: 'unit.kgm2', decimals: 1, lowerIsBetter: 'goal' },
    { key: 'bodyWater', read: field('bodyWater'), labelKey: 'body.metric.bodyWater', unitKey: 'unit.pct', decimals: 1, lowerIsBetter: false },
    { key: 'bmr', read: field('bmr'), labelKey: 'body.metric.bmr', unitKey: 'unit.kcal', decimals: 0, lowerIsBetter: false },
  ];
}

export const METRIC_SPECS: readonly MetricSpec[] = metricSpecs();

/**
 * Which metrics a scale actually measures.
 *
 * Health Connect carries weight, body fat, lean mass, bone mass and body water
 * mass. What is left over — BMI and BMR — is derived, and the detail sheet says
 * so rather than presenting a formula as something the scale weighed.
 *
 * Visceral fat, metabolic age and protein % used to sit on the other side of
 * this line. They were not merely derived, they were unmeasurable: Health
 * Connect has no record for any of them, so they came from reverse engineered
 * scale formulas over height/age/sex with impedance pinned at a constant.
 * Labelling them "derived" was not enough when the underlying reading did not
 * exist at all, so they were removed. See `Measurement`.
 */
const MEASURED_KEYS = new Set<MetricKey>(['weight', 'bodyFat', 'muscleMass', 'muscleMassPct', 'bodyWater']);

export function isMeasured(key: MetricKey): boolean {
  return MEASURED_KEYS.has(key);
}

/** Measurements sorted oldest → newest. Callers should not assume store order. */
export function sortByTime(measurements: Measurement[]): Measurement[] {
  return [...measurements].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * Twelve weekly points, oldest → newest.
 *
 * The bucket value is the **mean** of its readings, not the last one: BIA scales
 * are noisy enough that a single reading can swing body-fat by a point or two,
 * and a mean makes the trend legible without hiding real movement.
 */
export function buildSeries(
  sorted: Measurement[],
  read: MetricRead,
  now: Date,
  weeks = SERIES_WEEKS,
): number[] | null {
  const usable = sorted.filter(m => Number.isFinite(read(m)) && read(m) !== 0);
  const buckets = weeklyBuckets(usable, m => new Date(m.timestamp), now, weeks);
  return fillGaps(buckets.map(b => meanOf(b, read)));
}

/** The reading nearest `when`, within tolerance. Null when the window is empty. */
export function valueNear(
  sorted: Measurement[],
  read: MetricRead,
  when: Date,
  toleranceDays = DELTA_TOLERANCE_DAYS,
): number | null {
  const target = when.getTime();
  const tolerance = toleranceDays * MS_PER_DAY;

  let best: { distance: number; value: number } | null = null;
  for (const m of sorted) {
    const value = read(m);
    if (!Number.isFinite(value) || value === 0) continue;
    const distance = Math.abs(new Date(m.timestamp).getTime() - target);
    if (distance > tolerance) continue;
    // `<=` over a time-sorted list breaks ties toward the more recent reading,
    // which is the one the user is more likely to remember stepping onto.
    if (!best || distance <= best.distance) best = { distance, value };
  }
  return best?.value ?? null;
}

function resolveDirection(spec: MetricSpec, current: number, profile: UserProfile | null): boolean {
  if (spec.lowerIsBetter !== 'goal') return spec.lowerIsBetter;
  const target = profile?.targetWeight;
  if (typeof target !== 'number' || !Number.isFinite(target)) return true;
  return target < current;
}

export function buildMetricPoint(
  sorted: Measurement[],
  spec: MetricSpec,
  profile: UserProfile | null,
  now: Date,
): MetricPointVM {
  // `value` is the latest real reading — what the user calls "my last weigh-in" —
  // not the final bucket mean, which would disagree with the scale they just stepped off.
  let value = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const v = spec.read(sorted[i]);
    if (Number.isFinite(v) && v !== 0) { value = v; break; }
  }

  /**
   * A shorter window needs a tighter tolerance, or the 7-day delta reaches far
   * enough back to be the 30-day one — `DELTA_TOLERANCE_DAYS` is 7 by default.
   */
  const deltaOver = (days: number, toleranceDays = DELTA_TOLERANCE_DAYS): number | null => {
    const past = valueNear(sorted, spec.read, new Date(now.getTime() - days * MS_PER_DAY), toleranceDays);
    return past === null ? null : +(value - past).toFixed(2);
  };

  return {
    key: spec.key,
    labelKey: spec.labelKey,
    value,
    unitKey: spec.unitKey,
    decimals: spec.decimals,
    delta30d: deltaOver(DELTA_WINDOW_DAYS),
    delta7d: deltaOver(7, 3),
    delta90d: deltaOver(90, 14),
    lowerIsBetter: resolveDirection(spec, value, profile),
    series: buildSeries(sorted, spec.read, now),
  };
}

export function buildBody(
  measurements: Measurement[],
  profile: UserProfile | null,
  now: Date,
): BodyVM {
  const sorted = sortByTime(measurements);
  const latest = sorted.at(-1) ?? null;

  return {
    metrics: metricSpecs(profile?.height).map(spec => buildMetricPoint(sorted, spec, profile, now)),
    latestAt: latest ? new Date(latest.timestamp) : null,
    readingCount: sorted.length,
    hasData: sorted.length > 0,
  };
}

export function metricByKey(metrics: MetricPointVM[], key: MetricKey): MetricPointVM | undefined {
  return metrics.find(m => m.key === key);
}

/** True when a delta moves in the metric's good direction. Null delta is neither. */
export function isImproving(metric: MetricPointVM): boolean | null {
  if (metric.delta30d === null || metric.delta30d === 0) return null;
  return metric.lowerIsBetter ? metric.delta30d < 0 : metric.delta30d > 0;
}
