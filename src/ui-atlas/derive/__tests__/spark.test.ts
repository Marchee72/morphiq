import { describe, expect, it } from 'vitest';
import { sparkArea, sparkPath } from '../spark';

describe('sparkPath', () => {
  it('draws one command per point', () => {
    const path = sparkPath([1, 2, 3, 4], 300, 90, 6);
    expect(path.match(/[ML]/g)).toHaveLength(4);
    expect(path.startsWith('M')).toBe(true);
  });

  it('spans the full width inside the padding', () => {
    const path = sparkPath([1, 2, 3], 300, 90, 6);
    const xs = [...path.matchAll(/[ML]([\d.]+),/g)].map(m => Number(m[1]));
    expect(xs[0]).toBe(6);
    expect(xs.at(-1)).toBe(294);
  });

  it('puts the maximum at the top and the minimum at the bottom', () => {
    const path = sparkPath([10, 20], 100, 100, 0);
    const ys = [...path.matchAll(/,([\d.]+)/g)].map(m => Number(m[1]));
    expect(ys[0]).toBe(100); // lowest value sits at the baseline
    expect(ys[1]).toBe(0);
  });

  it('draws a flat series down the middle rather than dividing by zero', () => {
    const path = sparkPath([5, 5, 5], 100, 100, 0);
    expect(path).not.toContain('NaN');
    const ys = [...path.matchAll(/,([\d.]+)/g)].map(m => Number(m[1]));
    expect(new Set(ys).size).toBe(1);
  });

  it('renders a single reading as a centred hairline instead of nothing', () => {
    // The showcase divided by `length - 1` and produced NaN here.
    const path = sparkPath([80], 100, 100, 0);
    expect(path).toBe('M0,50 L100,50');
  });

  it('returns an empty path for an empty series', () => {
    expect(sparkPath([], 100, 100)).toBe('');
  });
});

describe('sparkArea', () => {
  it('closes the path along the baseline for the gradient fill', () => {
    expect(sparkArea([1, 2, 3], 300, 90, 6)).toMatch(/L294,90 L6,90 Z$/);
  });

  it('stays empty when there is nothing to fill', () => {
    expect(sparkArea([], 300, 90)).toBe('');
  });
});
