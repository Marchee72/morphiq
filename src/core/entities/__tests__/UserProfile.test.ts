import { describe, expect, it } from 'vitest';
import { MAX_HEIGHT_CM, MIN_HEIGHT_CM, parseHeightCm } from '../UserProfile';

/**
 * The height rule, in the one place both screens read it from.
 *
 * Onboarding and the profile editor used to carry their own copies of these
 * bounds. Nothing enforced that they agreed, and the editor did not exist at
 * all — height was set once and never correctable.
 */
describe('parseHeightCm', () => {
  it('accepts a plain figure', () => {
    expect(parseHeightCm('178')).toBe(178);
  });

  it('accepts a decimal comma, which Spanish keyboards offer first', () => {
    expect(parseHeightCm('178,5')).toBe(178.5);
    expect(parseHeightCm('178.5')).toBe(178.5);
  });

  it('ignores surrounding whitespace', () => {
    expect(parseHeightCm('  180 ')).toBe(180);
  });

  it('rejects anything that is not a number', () => {
    expect(parseHeightCm('')).toBeNull();
    expect(parseHeightCm('tall')).toBeNull();
    expect(parseHeightCm('1,7,8')).toBeNull();
  });

  it('rejects metres, the mistake this bound exists to catch', () => {
    // 1.78 would sail through a "positive number" check and turn every BMI,
    // BMR and body-fat figure in the app into nonsense.
    expect(parseHeightCm('1.78')).toBeNull();
  });

  it('rejects a figure with a digit too many', () => {
    expect(parseHeightCm('1780')).toBeNull();
  });

  it('accepts both ends of the range', () => {
    expect(parseHeightCm(String(MIN_HEIGHT_CM))).toBe(MIN_HEIGHT_CM);
    expect(parseHeightCm(String(MAX_HEIGHT_CM))).toBe(MAX_HEIGHT_CM);
    expect(parseHeightCm(String(MIN_HEIGHT_CM - 1))).toBeNull();
    expect(parseHeightCm(String(MAX_HEIGHT_CM + 1))).toBeNull();
  });
});
