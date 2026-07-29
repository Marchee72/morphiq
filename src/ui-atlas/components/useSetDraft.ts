import { useState } from 'react';
import type { SessionSetVM } from '../types';

export interface SetDraft {
  weight: number;
  reps: number;
  setWeight: (next: number | ((prev: number) => number)) => void;
  setReps: (next: number | ((prev: number) => number)) => void;
}

/**
 * The weight/reps a Train screen is currently editing.
 *
 * Re-seeds whenever the cursor moves to a different set. The concept's steppers
 * initialised from literals once and never updated, so changing set left the
 * previous set's numbers on screen while the "last time" line moved.
 *
 * Reset happens *during render* rather than in an effect: React documents this
 * as the way to derive state from props, and doing it in an effect renders one
 * frame with stale numbers and triggers a cascading re-render.
 */
/**
 * @param carry What was just done on this exercise, if anything — see below.
 */
export function useSetDraft(
  key: string,
  set: SessionSetVM | undefined,
  carry?: { weightKg: number; reps: number },
): SetDraft {
  /**
   * Order matters: what this set already holds, then what the set before it held
   * *today*, then what it held last time.
   *
   * The middle one was missing. Set 2 of an exercise you have not done in a
   * month opened on the month-old number even though set 1 had just gone in at
   * something else entirely — so every set after the first meant dialling the
   * same weight back in. You nearly always repeat the previous set or nudge it,
   * and a nudge from the right number is one flick.
   */
  const seedWeight = set?.weightKg || carry?.weightKg || set?.lastWeightKg || 0;
  const seedReps = set?.reps || carry?.reps || set?.lastReps || 10;

  /**
   * The stored values are part of the identity, not just the cursor position.
   * Correcting the current set from the list below writes to the store without
   * moving the cursor, and the wheels have to follow — otherwise they keep
   * showing what that set used to say. Turning a wheel does not write until the
   * set is logged, so this cannot fight the user mid-scroll.
   */
  const fullKey = `${key}:${set?.weightKg ?? ''}:${set?.reps ?? ''}`;

  const [seenKey, setSeenKey] = useState(fullKey);
  const [weight, setWeight] = useState(seedWeight);
  const [reps, setReps] = useState(seedReps);

  if (seenKey !== fullKey) {
    setSeenKey(fullKey);
    setWeight(seedWeight);
    setReps(seedReps);
  }

  return { weight, reps, setWeight, setReps };
}
