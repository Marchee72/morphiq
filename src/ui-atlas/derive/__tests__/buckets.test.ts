import { describe, expect, it } from 'vitest';
import { fillGaps, meanOf, pct, startOfWeek, weeklyBuckets, MS_PER_DAY, MS_PER_WEEK } from '../buckets';

const NOW = new Date(2026, 6, 27, 12, 0, 0); // Monday 27 July 2026
const at = (d: { date: Date }) => d.date;

describe('weeklyBuckets', () => {
  it('returns exactly `weeks` buckets, oldest first', () => {
    const buckets = weeklyBuckets([], at, NOW, 12);
    expect(buckets).toHaveLength(12);
    expect(buckets[0].end.getTime()).toBeLessThan(buckets[11].end.getTime());
    expect(buckets[11].end.getTime()).toBe(NOW.getTime());
  });

  it('drops items outside the window rather than clamping them into the edges', () => {
    const items = [
      { date: new Date(NOW.getTime() - 20 * MS_PER_WEEK) }, // too old
      { date: new Date(NOW.getTime() + MS_PER_DAY) },       // future
      { date: new Date(NOW.getTime() - MS_PER_DAY) },       // in the last bucket
    ];
    const buckets = weeklyBuckets(items, at, NOW, 12);
    expect(buckets.flatMap(b => b.items)).toHaveLength(1);
    expect(buckets[11].items).toHaveLength(1);
  });

  it('places an item landing exactly on `now` in the final bucket', () => {
    const buckets = weeklyBuckets([{ date: NOW }], at, NOW, 12);
    expect(buckets[11].items).toHaveLength(1);
  });

  it('assigns each item to the week it falls in', () => {
    const items = [
      { date: new Date(NOW.getTime() - 1 * MS_PER_WEEK - MS_PER_DAY) },
      { date: new Date(NOW.getTime() - 5 * MS_PER_WEEK) },
    ];
    const buckets = weeklyBuckets(items, at, NOW, 12);
    expect(buckets[10].items).toHaveLength(1);
    expect(buckets[6].items).toHaveLength(1);
  });
});

describe('meanOf', () => {
  it('averages a bucket', () => {
    const bucket = { start: NOW, end: NOW, items: [2, 4, 6] };
    expect(meanOf(bucket, v => v)).toBe(4);
  });

  it('returns null for an empty bucket rather than zero', () => {
    expect(meanOf({ start: NOW, end: NOW, items: [] }, v => v as number)).toBeNull();
  });

  it('ignores non-finite readings', () => {
    const bucket = { start: NOW, end: NOW, items: [2, NaN, 6] };
    expect(meanOf(bucket, v => v)).toBe(4);
  });
});

describe('fillGaps', () => {
  it('forward-fills interior gaps', () => {
    expect(fillGaps([1, null, null, 4])).toEqual([1, 1, 1, 4]);
  });

  it('back-fills a leading gap so a chart never opens at zero', () => {
    expect(fillGaps([null, null, 3, 4])).toEqual([3, 3, 3, 4]);
  });

  it('returns null for an all-null series instead of inventing zeros', () => {
    expect(fillGaps([null, null, null])).toBeNull();
  });

  it('leaves a complete series untouched', () => {
    expect(fillGaps([1, 2, 3])).toEqual([1, 2, 3]);
  });
});

describe('pct', () => {
  it('clamps to 0–100', () => {
    expect(pct(5, 10)).toBe(50);
    expect(pct(20, 10)).toBe(100);
    expect(pct(-5, 10)).toBe(0);
  });

  it('guards the divide-by-zero', () => {
    expect(pct(5, 0)).toBe(0);
  });
});

describe('startOfWeek', () => {
  it('anchors to Monday', () => {
    expect(startOfWeek(new Date(2026, 6, 27)).getDay()).toBe(1); // already Monday
    expect(startOfWeek(new Date(2026, 6, 30)).getDate()).toBe(27); // Thursday → back to Mon 27
  });

  it('treats Sunday as the end of the week, not the start', () => {
    // Sunday 26 July 2026 belongs to the week beginning Monday 20 July.
    expect(startOfWeek(new Date(2026, 6, 26)).getDate()).toBe(20);
  });
});
