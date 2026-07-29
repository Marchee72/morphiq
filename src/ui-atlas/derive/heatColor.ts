/**
 * Maps a muscle group's weekly set count to a heat color on the atlas palette.
 *
 * The gradient runs from the figure's limb tone (rested) through muted to
 * clay-strong (trained hard). The reference target is the midpoint of the
 * commonly cited 10–20 hypertrophy range — the same number the old X/16
 * display used — but here it only sets the scale, not a goal the user sees.
 */

/** The set count at which a group reads as "fully trained." Matches the old default target. */
const REFERENCE_SETS = 16;

/** Normalised 0–1 heat level, clamped. */
export function heatLevel(sets: number, reference = REFERENCE_SETS): number {
  if (reference <= 0) return 0;
  return Math.max(0, Math.min(1, sets / reference));
}

/**
 * Returns a CSS color for the given heat level.
 *
 * Level 0 → `--at-figure-limb` (rested, dark).
 * Level 1 → `--clay-strong` (trained hard, red).
 * Midpoints → an `rgb()` blend of the two, so the SVG `fill` is always a
 * concrete color the browser can render (CSS custom properties don't
 * interpolate inside SVG `fill` across all browsers).
 */
export function heatColor(level: number): string {
  if (level <= 0) return 'var(--at-figure-limb)';
  if (level >= 1) return 'var(--clay-strong)';

  // Blend from the limb tone (#3d3128 dark / #e0d0bc light) toward clay-strong
  // (#c4643c). We use the dark-mode limb tone as the rested anchor because the
  // card sits on a dark surface in both themes.
  const rested = { r: 0x3d, g: 0x31, b: 0x28 };
  const trained = { r: 0xc4, g: 0x64, b: 0x3c };
  const r = Math.round(rested.r + (trained.r - rested.r) * level);
  const g = Math.round(rested.g + (trained.g - rested.g) * level);
  const b = Math.round(rested.b + (trained.b - rested.b) * level);
  return `rgb(${r}, ${g}, ${b})`;
}