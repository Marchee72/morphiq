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
 * Level 0 → `--at-figure-limb` (rested).
 * Level 1 → `--clay-strong` (trained hard).
 * Midpoints → `color-mix()` of the two.
 *
 * The mix is left to CSS rather than computed here, because `--at-figure-limb`
 * is not one color: it is `#e0d0bc` in the light theme and `#3d3128` in the
 * dark one. Blending hex by hand meant picking one of them, and this picked the
 * dark tone — so in the light theme a rested group rendered pale while a group
 * with a single set rendered near-black. The scale inverted at the bottom, and
 * the legend bar below the figure, which is plain CSS, disagreed with the
 * figure above it. `color-mix` resolves the token in the theme it is drawn in,
 * so both ends and everything between them follow the theme.
 */
export function heatColor(level: number): string {
  if (level <= 0) return 'var(--at-figure-limb)';
  if (level >= 1) return 'var(--clay-strong)';
  return `color-mix(in srgb, var(--clay-strong) ${Math.round(level * 100)}%, var(--at-figure-limb))`;
}