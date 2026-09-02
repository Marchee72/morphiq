import { describe, it, expect } from 'vitest';
import { weightLadder, snapWeight, WEIGHT_DECIMALS } from '../weightLadder';

describe('weightLadder', () => {
  it('offers exactly the four allowed rungs per kilo', () => {
    const ladder = weightLadder(3);
    expect(ladder).toEqual([0, 0.125, 0.5, 0.75, 1, 1.125, 1.5, 1.75, 2, 2.125, 2.5, 2.75, 3]);
  });

  it('excludes .25 and .375, which are not on the list', () => {
    const ladder = weightLadder(100);
    expect(ladder).not.toContain(80.25);
    expect(ladder).not.toContain(80.375);
  });

  it('does not drift off floating point across the full range', () => {
    // Built by offset rather than repeated addition precisely so this holds.
    const ladder = weightLadder(300);
    expect(ladder).toContain(287.125);
    expect(ladder.every(v => WEIGHT_DECIMALS.includes((v % 1) as never) || v % 1 === 0)).toBe(true);
  });

  it('never exceeds the maximum', () => {
    expect(weightLadder(2).at(-1)).toBe(2);
  });
});

describe('snapWeight', () => {
  it('lands on the nearest rung, and the gaps are uneven', () => {
    // 80.3 is 0.175 above 80.125 and 0.2 below 80.5 — the lower rung wins.
    expect(snapWeight(80.3)).toBe(80.125);
    // 80.4 is 0.275 above 80.125 and 0.1 below 80.5 — now the upper one does.
    expect(snapWeight(80.4)).toBe(80.5);
  });

  it('promotes to the next whole kilo rather than sticking at .75', () => {
    expect(snapWeight(80.9)).toBe(81);
  });

  it('leaves an allowed value alone', () => {
    for (const value of [0, 60, 80.125, 80.5, 80.75]) {
      expect(snapWeight(value)).toBe(value);
    }
  });

  it('is idempotent — snapping a snapped value changes nothing', () => {
    for (const value of [12.3, 47.6, 80.9, 199.44]) {
      expect(snapWeight(snapWeight(value))).toBe(snapWeight(value));
    }
  });

  it('always produces a value the ladder actually contains', () => {
    const ladder = new Set(weightLadder(300));
    for (const value of [0.1, 3.7, 62.26, 145.9, 299.99]) {
      expect(ladder.has(snapWeight(value))).toBe(true);
    }
  });

  it('floors nonsense at zero rather than going negative', () => {
    expect(snapWeight(-5)).toBe(0);
    expect(snapWeight(Number.NaN)).toBe(0);
  });
});
