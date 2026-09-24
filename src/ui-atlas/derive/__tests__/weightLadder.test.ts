import { describe, it, expect } from 'vitest';
import { snapWeight, WEIGHT_DECIMALS } from '../weightLadder';

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
    for (const value of [0.1, 3.7, 62.26, 145.9, 299.99]) {
      const tail = snapWeight(value) % 1;
      expect(WEIGHT_DECIMALS.some(d => d === tail)).toBe(true);
    }
  });

  it('floors nonsense at zero rather than going negative', () => {
    expect(snapWeight(-5)).toBe(0);
    expect(snapWeight(Number.NaN)).toBe(0);
  });
});
