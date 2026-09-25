/**
 * The plate grid the weight wheel works on.
 *
 * Every value the wheel, its −/+ and the arrow keys produce is a multiple of
 * 2,5 kg — the smallest pair of plates on most racks. Exact entry (tapping the
 * number) keeps `snapWeight`'s finer grid for the weights plates do not reach.
 */

export const PLATE_KG = 2.5;

/** Nearest plate multiple, never negative. */
export function toPlate(kg: number): number {
  return Math.max(0, Math.round(kg / PLATE_KG) * PLATE_KG);
}

/**
 * One plate up or down from wherever the value is. Off the grid (81,25 typed
 * by hand) the first step lands on the neighbouring multiple — 82,5 going up,
 * 80 going down — rather than skipping one.
 */
export function stepPlate(kg: number, dir: 1 | -1): number {
  const eps = 1e-9;
  const base = dir > 0 ? Math.floor(kg / PLATE_KG + eps) : Math.ceil(kg / PLATE_KG - eps);
  return Math.max(0, (base + dir) * PLATE_KG);
}

export type WheelZone = 'warmup' | 'volume' | 'strength' | 'heavy' | 'record';

/** Intensity by share of the best e1RM: warm-up <60%, volume 60–75, strength 75–85, heavy 85–100. */
export function zoneOf(kg: number, best: number): WheelZone {
  const f = kg / best;
  if (f > 1) return 'record';
  if (f >= 0.85) return 'heavy';
  if (f >= 0.75) return 'strength';
  if (f >= 0.6) return 'volume';
  return 'warmup';
}
