/**
 * Time bucketing shared by every trend in the app.
 *
 * Pure — no React, no store, no Dexie. Everything under `derive/` obeys that rule,
 * which is what lets these run as millisecond unit tests instead of jsdom ones.
 */

export const MS_PER_DAY = 86_400_000;
export const MS_PER_WEEK = 7 * MS_PER_DAY;

export interface Bucket<T> {
  start: Date;
  end: Date;
  items: T[];
}

/**
 * Buckets anchored to `now` walking backwards, index 0 = oldest.
 *
 * Anchoring to `now` rather than to calendar Mondays matters: a Monday-aligned
 * 12-week window opens with a partial bucket whose mean is computed from one or
 * two readings, which shows up as a spurious spike at the left edge of every chart.
 */
export function weeklyBuckets<T>(
  items: T[],
  at: (item: T) => Date,
  now: Date,
  weeks: number,
): Bucket<T>[] {
  const end = now.getTime();
  const buckets: Bucket<T>[] = Array.from({ length: weeks }, (_, i) => {
    const bucketEnd = end - (weeks - 1 - i) * MS_PER_WEEK;
    return { start: new Date(bucketEnd - MS_PER_WEEK), end: new Date(bucketEnd), items: [] };
  });

  const windowStart = end - weeks * MS_PER_WEEK;
  for (const item of items) {
    const t = at(item).getTime();
    if (t <= windowStart || t > end) continue;
    const index = weeks - 1 - Math.floor((end - t) / MS_PER_WEEK);
    // Guard the boundary: an item landing exactly on `end` floors to index `weeks`.
    buckets[Math.min(weeks - 1, Math.max(0, index))].items.push(item);
  }
  return buckets;
}

/** Mean of a bucket, or null when it holds no readings. */
export function meanOf<T>(bucket: Bucket<T>, value: (item: T) => number): number | null {
  if (bucket.items.length === 0) return null;
  const valid = bucket.items.map(value).filter(v => Number.isFinite(v));
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/**
 * Forward-fills gaps, then back-fills the head so a chart never opens at zero.
 * An all-null series stays all-null — the caller decides whether that means
 * "no data" or a flat line, and silently returning zeros would hide the difference.
 */
export function fillGaps(values: (number | null)[]): number[] | null {
  if (values.every(v => v === null)) return null;

  const out = [...values];
  let last: number | null = null;
  for (let i = 0; i < out.length; i++) {
    if (out[i] === null) out[i] = last;
    else last = out[i];
  }
  // Anything still null is a leading gap; back-fill from the first real reading.
  const firstReal = out.find(v => v !== null) as number;
  return out.map(v => (v === null ? firstReal : v)) as number[];
}

/** Local calendar-day key, for grouping by day without UTC drift. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Monday-start week containing `date`. */
export function startOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const offset = (d.getDay() + 6) % 7; // Sunday(0) → 6
  d.setDate(d.getDate() - offset);
  return d;
}

export function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 3_600_000;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Percentage of `a` against `b`, clamped to 0–100. Guards the divide-by-zero. */
export function pct(a: number, b: number): number {
  if (!b) return 0;
  return clamp(Math.round((a / b) * 100), 0, 100);
}
