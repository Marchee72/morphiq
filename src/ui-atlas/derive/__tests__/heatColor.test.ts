import { describe, expect, it } from 'vitest';
import { heatColor, heatLevel } from '../heatColor';

describe('heatLevel', () => {
  it('returns 0 for zero sets', () => {
    expect(heatLevel(0, 16)).toBe(0);
  });

  it('returns 1 when sets meet the reference target', () => {
    expect(heatLevel(16, 16)).toBe(1);
  });

  it('clamps above 1 when sets exceed the target', () => {
    expect(heatLevel(24, 16)).toBe(1);
  });

  it('returns 0.5 at half the target', () => {
    expect(heatLevel(8, 16)).toBeCloseTo(0.5);
  });
});

describe('heatColor', () => {
  it('returns the rested token at level 0', () => {
    expect(heatColor(0)).toBe('var(--at-figure-limb)');
  });

  it('returns the trained token at level 1', () => {
    expect(heatColor(1)).toBe('var(--clay-strong)');
  });

  it('returns an intermediate color at level 0.5', () => {
    // A mix of the two ends, not a raw token. Both tokens have to survive into
    // the result: a blend computed here instead would have to pick one theme's
    // value for the rested end and would be wrong in the other.
    expect(heatColor(0.5)).toBe(
      'color-mix(in srgb, var(--clay-strong) 50%, var(--at-figure-limb))',
    );
  });

  it('mixes toward the trained end as the level rises', () => {
    expect(heatColor(0.25)).toContain('var(--clay-strong) 25%');
    expect(heatColor(0.75)).toContain('var(--clay-strong) 75%');
  });
});