import { describe, expect, it } from 'vitest';
import { buildSteps, fromDayString } from '../steps';

const NOW = new Date(2026, 6, 29, 18, 0);

describe('fromDayString', () => {
  it('reads a day string as local midnight, not as UTC', () => {
    // `new Date('2026-07-29')` is UTC midnight, which is the 28th for anyone
    // west of Greenwich — an evening walk would land on the wrong day.
    const date = fromDayString('2026-07-29');
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(6);
    expect(date?.getDate()).toBe(29);
    expect(date?.getHours()).toBe(0);
  });

  it('rejects anything that is not a date', () => {
    expect(fromDayString('')).toBeNull();
    expect(fromDayString('not-a-date')).toBeNull();
  });
});

describe('buildSteps', () => {
  it('says nothing rather than zero when the source has not answered', () => {
    const steps = buildSteps([], NOW);
    expect(steps.today).toBeNull();
    expect(steps.weeklyAvg).toBeNull();
    expect(steps.recent).toHaveLength(0);
  });

  it('finds today among the days reported', () => {
    const steps = buildSteps([
      { date: '2026-07-27', steps: 6000 },
      { date: '2026-07-29', steps: 8420 },
      { date: '2026-07-28', steps: 10000 },
    ], NOW);

    expect(steps.today).toBe(8420);
    // Newest first, whatever order the source used.
    expect(steps.recent.map(d => d.steps)).toEqual([8420, 10000, 6000]);
  });

  it('is null for today when only older days reported', () => {
    const steps = buildSteps([{ date: '2026-07-28', steps: 10000 }], NOW);
    expect(steps.today).toBeNull();
    expect(steps.weeklyAvg).toBe(10000);
  });

  it('drops days outside the window', () => {
    const steps = buildSteps([
      { date: '2026-07-29', steps: 8000 },
      { date: '2026-06-01', steps: 20000 },
    ], NOW);
    expect(steps.recent).toHaveLength(1);
    expect(steps.weeklyAvg).toBe(8000);
  });

  it('averages only the days that reported', () => {
    // A week the phone was left at home twice must not average as if those
    // days were zero-step days.
    const steps = buildSteps([
      { date: '2026-07-29', steps: 8000 },
      { date: '2026-07-28', steps: 12000 },
    ], NOW);
    expect(steps.weeklyAvg).toBe(10000);
  });
});
