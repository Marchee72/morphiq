/**
 * The weights a dial will actually stop on.
 *
 * The old model was a single 1.25 kg step, which is the smallest plate pair on
 * most racks but not the smallest weight anyone lifts: fixed dumbbells, machine
 * stacks and micro plates all land elsewhere, and the dial could not express
 * any of them.
 *
 * So the integer part is unrestricted and only the fraction is constrained, to
 * the three that correspond to real equipment. Note the gaps between them are
 * deliberately uneven — 0.125 to 0.5 is a bigger jump than 0.5 to 0.75 — which
 * is exactly why this cannot go back to being a `step` and why `snapWeight`
 * has a test.
 */

/** Allowed fractional parts of a kilo. */
export const WEIGHT_DECIMALS = [0, 0.125, 0.5, 0.75] as const;

/** Decimal places any of the above needs to render exactly. */
export const WEIGHT_PRECISION = 3;

/**
 * Every selectable weight from 0 to `max`, ascending.
 *
 * Built by whole kilo and offset rather than by repeated addition, because
 * accumulating 0.125 a thousand times drifts off binary floating point and the
 * dial would stop matching the values it snaps to.
 */
export function weightLadder(max: number): number[] {
  const values: number[] = [];
  for (let kg = 0; kg <= max; kg++) {
    for (const decimal of WEIGHT_DECIMALS) {
      const value = kg + decimal;
      if (value <= max) values.push(value);
    }
  }
  return values;
}

/**
 * The nearest allowed weight to whatever was typed.
 *
 * Ties go up, which matters more than it sounds: it makes the function stable
 * for values landing exactly between two rungs rather than dependent on
 * floating-point noise.
 */
export function snapWeight(kg: number): number {
  if (!Number.isFinite(kg) || kg <= 0) return 0;

  const whole = Math.floor(kg);
  const fraction = kg - whole;

  // The next kilo's zero is a candidate too — 80.9 belongs to 81, not to 80.75.
  const candidates = [...WEIGHT_DECIMALS.map(d => whole + d), whole + 1];

  let best = candidates[0];
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = Math.abs(candidate - (whole + fraction));
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  // Rounded because the arithmetic above can leave 80.87500000000001 behind,
  // which then fails an equality check against the ladder it came from.
  return Number(best.toFixed(WEIGHT_PRECISION));
}
