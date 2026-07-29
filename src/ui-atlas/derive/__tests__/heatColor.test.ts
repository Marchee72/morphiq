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
    const color = heatColor(0.5);
    // An rgba/hsl/rgb interpolation, not a raw token — the midpoint is a blend.
    expect(color).toMatch(/rgba|hsl|rgb/);
  });
});